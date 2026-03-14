/**
 * Synchronisation d'un utilisateur Auth0 vers Supabase.
 *
 * ⚠️ Auth0 N'EST PAS la source de vérité métier :
 * - Auth0 gère uniquement l'authentification (identité, tokens, app_metadata).
 * - Les rôles métier (patient / doctor / ...) et toute logique médicale
 *   doivent rester dans Postgres (via Supabase).
 *
 * Pourquoi un UPSERT ?
 * - Pour gérer à la fois la première connexion (INSERT) et les connexions suivantes (UPDATE)
 *   avec un seul appel, de manière idempotente.
 * - Pour éviter les doublons grâce à la contrainte UNIQUE sur `auth0_sub`.
 *
 * Stratégie d'intégrité des données :
 * - On utilise `auth0_sub` comme identifiant fonctionnel UNIQUE.
 * - On ne modifie JAMAIS un rôle déjà défini en base (la DB reste source de vérité).
 * - L'appel est "fire-and-forget" : en cas d'erreur, on log en console mais on ne bloque pas l'UI.
 */

import type { User } from '@auth0/auth0-react';
import { supabase } from './supabase';
import { ROLES_CLAIM, DOCTOR_ROLE, getRoles } from '../utils/auth';

export type BusinessRole = 'patient' | 'doctor';

/**
 * Helper centralisé pour déduire le rôle métier à partir des infos Auth0.
 *
 * Stratégie actuelle :
 * - 1) Si app_metadata.is_superuser === true        -> 'doctor'
 * - 2) Sinon, si les rôles Auth0 contiennent le rôle "Superuser" -> 'doctor'
 * - 3) Sinon                                        -> 'patient'
 *
 * Cela permet :
 * - de respecter app_metadata.is_superuser (spécification métier)
 * - d'être robuste si app_metadata n'est pas renvoyé au frontend
 *   mais que les rôles Auth0 (claim ROLES_CLAIM) sont bien présents.
 */
export function deriveRoleFromAuth0(user: User | undefined | null): BusinessRole {
  const isSuperuserMetadata =
    user && typeof (user as any).app_metadata === 'object'
      ? Boolean((user as any).app_metadata?.is_superuser)
      : false;

  if (isSuperuserMetadata) {
    return 'doctor';
  }

  // Fallback robuste : si on ne voit pas app_metadata, on regarde les rôles
  // déjà utilisés ailleurs dans l'app (ROLES_CLAIM, DOCTOR_ROLE).
  const roles = getRoles(user as any);
  const hasDoctorRole = roles.includes(DOCTOR_ROLE);

  return hasDoctorRole ? 'doctor' : 'patient';
}

/**
 * Synchronise l'utilisateur Auth0 courant avec la table `public.users`.
 *
 * Règles :
 * - Si `user` ou `user.sub` est absent → on ne fait rien.
 * - On upsert sur la clé fonctionnelle UNIQUE `auth0_sub`.
 * - On ne remplace jamais un rôle existant déjà défini en DB.
 * - On log les erreurs mais on ne lève pas d'exception (pour ne pas bloquer le rendu UI).
 */
export async function syncUserWithSupabase(user: User | undefined | null): Promise<void> {
  if (!user) {
    // Rien à synchroniser
    return;
  }

  const auth0_sub = (user as any).sub as string | undefined;

  if (!auth0_sub) {
    console.warn('[syncUserWithSupabase] Auth0 user has no "sub" claim, aborting sync.');
    return;
  }

  const derivedRole = deriveRoleFromAuth0(user);

  try {
    // 1) On regarde s'il existe déjà un enregistrement pour cet utilisateur.
    //    On évite volontairement single()/maybeSingle() pour ne pas transformer "0 lignes"
    //    en erreur : on veut simplement un tableau éventuellement vide.
    const { data: existingRows, error: fetchError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth0_sub', auth0_sub)
      .limit(1);

    if (fetchError) {
      console.warn('[syncUserWithSupabase] Failed to fetch existing user record:', fetchError);
      // On arrête ici pour ne pas prendre de risque sur les données.
      return;
    }

    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    // 2) Préparation du payload d'upsert.
    //    - On n'écrase jamais un rôle existant (on ne met le rôle que s'il est vide côté DB).
    //    - On fournit l'id si la ligne existe déjà pour un upsert explicite.
    const payload: Record<string, any> = {
      auth0_sub,
    };

    if (existing?.id) {
      payload.id = existing.id;
    }

    if (!existing?.role) {
      // Aucun rôle encore défini côté DB → on initialise depuis Auth0 (hint),
      // mais ensuite la DB restera la source de vérité.
      payload.role = derivedRole;
    }

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'auth0_sub' });

    if (upsertError) {
      console.warn('[syncUserWithSupabase] Failed to upsert user into public.users:', upsertError);
    }
  } catch (err) {
    // On ne casse jamais le flux UI : simple log.
    console.warn('[syncUserWithSupabase] Unexpected error during sync:', err);
  }
}

