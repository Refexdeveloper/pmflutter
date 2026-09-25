import { useEffect, useMemo, useState } from 'react';
import {
  fetchUserMasterUsers,
  toUserMasterPickerOptions,
} from './userMaster.js';

/**
 * Loads Refex One User Master people for name/email pickers (datalist options).
 */
export function useUserMasterOptions(currentUser = null) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUserMasterUsers()
      .then((rows) => {
        if (!cancelled) setUsers(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        console.warn('User Master fetch failed:', err?.message || err);
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () => toUserMasterPickerOptions(users, currentUser),
    [users, currentUser],
  );

  return { options, users, loading };
}
