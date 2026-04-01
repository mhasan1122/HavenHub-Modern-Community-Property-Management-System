import { useState, useEffect, useCallback } from 'react';
import { getBulletins, createBulletin, Bulletin } from '../services/bulletinService';
import { useAppSelector } from '../store/hooks';

interface UseBulletinsProps {
  status?: 'current' | 'pending' | 'archive';
  creator?: string;
  search?: string;
  priority?: string;
  labels?: string;
  my_posts?: boolean;
}

export const useBulletins = (props: UseBulletinsProps = {}) => {
  console.log('🔍 useBulletins hook called with props:', props);
  const { user, accessToken } = useAppSelector((state) => state.auth);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchBulletins = useCallback(async () => {
    if (!accessToken) {
      setError('Authentication required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params: any = {};
      
      if (props.status) params.status = props.status;
      if (props.creator) params.creator = props.creator;
      if (props.search) params.search = props.search;
      if (props.priority) params.priority = props.priority;
      if (props.labels) params.labels = props.labels;
      if (props.my_posts) params.my_posts = props.my_posts;

      console.log('🔍 useBulletins fetchBulletins called with params:', params);
      console.log('🔍 useBulletins current state:', { bulletinsCount: bulletins.length, hasLoadedOnce });

      const data = await getBulletins(params, accessToken);
      console.log('📡 useBulletins received data:', { count: data.length, status: props.status });
      
      setBulletins(data);
      setHasLoadedOnce(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bulletins';
      setError(errorMessage);
      console.error('❌ Error fetching bulletins:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, props.status, props.creator, props.search, props.priority, props.labels, props.my_posts]);

  const createNewBulletin = useCallback(async (bulletinData: any) => {
    if (!accessToken) {
      throw new Error('Authentication required');
    }

    try {
      const newBulletin = await createBulletin(bulletinData, accessToken);
      
      // Always add the new bulletin to the list if it's created by the current user
      // This ensures new bulletins show up immediately regardless of current filters
      if (newBulletin.creator.id === Number(user?.id)) {
        console.log('🆕 Adding new bulletin to list:', newBulletin.title, 'Status:', newBulletin.status);
        
        // Always add the new bulletin to the current list so it shows up immediately
        // This works regardless of status filters
        setBulletins(prev => [newBulletin, ...prev]);
      }
      
      return newBulletin;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bulletin';
      throw new Error(errorMessage);
    }
  }, [accessToken, user?.id]);

  // Add bulletin optimistically (before API call)
  const addBulletinOptimistically = useCallback((bulletin: any) => {
    console.log('🚀 Adding bulletin optimistically:', bulletin.title);
    setBulletins(prev => [bulletin, ...prev]);
  }, []);

  const refreshBulletins = useCallback(() => {
    fetchBulletins();
  }, [fetchBulletins]);

  // Force refresh that ensures fresh data
  const forceRefreshBulletins = useCallback(async () => {
    console.log('🔄 Force refresh starting for status:', props.status);
    
    setLoading(true);
    setError(null);
    
    try {
      const params: any = {};
      
      if (props.status) params.status = props.status;
      if (props.creator) params.creator = props.creator;
      if (props.search) params.search = props.search;
      if (props.priority) params.priority = props.priority;
      if (props.labels) params.labels = props.labels;
      if (props.my_posts) params.my_posts = props.my_posts;
      
      // Cache busting - force unique timestamp
      const uniqueTimestamp = Date.now() + Math.random();
      params._t = uniqueTimestamp;
      console.log('🕒 Using unique cache-busting timestamp:', uniqueTimestamp);

      const data = await getBulletins(params, accessToken || undefined);
      console.log('📡 Force refresh received', data.length, 'bulletins for status:', props.status);
      console.log('📊 BEFORE setBulletins - current bulletins array length:', bulletins.length);
      console.log('📊 BEFORE setBulletins - new data array length:', data.length);
      console.log('📊 BEFORE setBulletins - new data items:', data.map(b => ({ id: b.id, title: b.title })));
      
      setBulletins(data);
      console.log('✅ setBulletins called with new data');
      
      setHasLoadedOnce(true);
      console.log('✅ setHasLoadedOnce(true) called');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bulletins';
      setError(errorMessage);
      console.error('❌ Force refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, props.status, props.creator, props.search, props.priority, props.labels, props.my_posts]);

  // Global refresh function that can be called from anywhere
  const refreshAllBulletins = useCallback(() => {
    console.log('🔄 Refreshing all bulletin lists');
    fetchBulletins();
  }, [fetchBulletins]);

  // Get bulletins by status
  const getBulletinsByStatus = useCallback(() => {
    const statusCounts: Record<string, number> = {};
    
    bulletins.forEach(bulletin => {
      const status = bulletin.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return statusCounts;
  }, [bulletins]);

  // Filter bulletins by current user
  const getMyBulletins = useCallback(() => {
    if (!user?.id) return [];
    return bulletins.filter(bulletin => bulletin.creator.id === Number(user.id));
  }, [bulletins, user?.id]);

  // Note: Approve/reject functions removed - handle these at component level

  useEffect(() => {
    fetchBulletins();
  }, [fetchBulletins]);

  // DEBUG: Track when bulletins state changes
  useEffect(() => {
    console.log('🔄 BULLETINS STATE CHANGED for status:', props.status);
    console.log('📊 New bulletins count:', bulletins.length);
    console.log('📊 New bulletins items:', bulletins.map(b => ({ id: b.id, title: b.title })));
  }, [bulletins, props.status]);

  // Re-fetch when props change
  useEffect(() => {
    if (hasLoadedOnce) {
      console.log('🔄 Props changed, re-fetching bulletins with new params:', props);
      fetchBulletins();
    }
  }, [props.status, props.creator, props.search, props.priority, props.labels, props.my_posts, hasLoadedOnce, fetchBulletins]);

  return {
    bulletins,
    loading,
    error,
    hasLoadedOnce,
    fetchBulletins,
    createNewBulletin,
    addBulletinOptimistically,
    refreshBulletins,
    forceRefreshBulletins,
    refreshAllBulletins,
    getBulletinsByStatus,
    getMyBulletins,
  };
};
