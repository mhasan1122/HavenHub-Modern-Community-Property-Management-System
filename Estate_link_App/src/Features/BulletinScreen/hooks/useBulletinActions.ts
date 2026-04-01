import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

interface BulletinAction {
  id: string;
  action: 'pin' | 'unpin' | 'approve' | 'reject' | 'archive' | 'restore' | 'delete';
  comment?: string;
}

interface UseBulletinActionsProps {
  onPin?: (id: string) => Promise<void>;
  onUnpin?: (id: string) => Promise<void>;
  onApprove?: (id: string, comment?: string) => Promise<void>;
  onReject?: (id: string, comment?: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onRestore?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const useBulletinActions = ({
  onPin,
  onUnpin,
  onApprove,
  onReject,
  onArchive,
  onRestore,
  onDelete,
}: UseBulletinActionsProps) => {
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());

  const setActionLoading = useCallback((actionId: string, loading: boolean) => {
    setLoadingActions(prev => {
      const newSet = new Set(prev);
      if (loading) {
        newSet.add(actionId);
      } else {
        newSet.delete(actionId);
      }
      return newSet;
    });
  }, []);

  const isActionLoading = useCallback((actionId: string) => {
    return loadingActions.has(actionId);
  }, [loadingActions]);

  const handlePin = useCallback(async (id: string) => {
    if (!onPin) return;
    
    const actionId = `pin-${id}`;
    setActionLoading(actionId, true);
    
    try {
      await onPin(id);
    } catch (error) {
      console.error('Error pinning bulletin:', error);
      Alert.alert('Error', 'Failed to pin bulletin');
    } finally {
      setActionLoading(actionId, false);
    }
  }, [onPin]);

  const handleUnpin = useCallback(async (id: string) => {
    if (!onUnpin) return;
    
    const actionId = `unpin-${id}`;
    setActionLoading(actionId, true);
    
    try {
      await onUnpin(id);
    } catch (error) {
      console.error('Error unpinning bulletin:', error);
      Alert.alert('Error', 'Failed to unpin bulletin');
    } finally {
      setActionLoading(actionId, false);
    }
  }, [onUnpin]);

  const handleApprove = useCallback(async (id: string, comment?: string) => {
    if (!onApprove) return;
    
    const actionId = `approve-${id}`;
    setActionLoading(actionId, true);
    
    try {
      await onApprove(id, comment);
    } catch (error) {
      console.error('Error approving bulletin:', error);
      Alert.alert('Error', 'Failed to approve bulletin');
    } finally {
      setActionLoading(actionId, false);
    }
  }, [onApprove]);

  const handleReject = useCallback(async (id: string, comment?: string) => {
    if (!onReject) return;
    
    const actionId = `reject-${id}`;
    setActionLoading(actionId, true);
    
    try {
      await onReject(id, comment);
    } catch (error) {
      console.error('Error rejecting bulletin:', error);
      Alert.alert('Error', 'Failed to reject bulletin');
    } finally {
      setActionLoading(actionId, false);
    }
  }, [onReject]);

  const handleArchive = useCallback(async (id: string) => {
    if (!onArchive) return;
    
    Alert.alert(
      'Archive Bulletin',
      'Are you sure you want to archive this bulletin? It will be moved to the archive section.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            const actionId = `archive-${id}`;
            setActionLoading(actionId, true);
            
            try {
              await onArchive(id);
            } catch (error) {
              console.error('Error archiving bulletin:', error);
              Alert.alert('Error', 'Failed to archive bulletin');
            } finally {
              setActionLoading(actionId, false);
            }
          },
        },
      ]
    );
  }, [onArchive]);

  const handleRestore = useCallback(async (id: string) => {
    if (!onRestore) return;
    
    const actionId = `restore-${id}`;
    setActionLoading(actionId, true);
    
    try {
      await onRestore(id);
    } catch (error) {
      console.error('Error restoring bulletin:', error);
      Alert.alert('Error', 'Failed to restore bulletin');
    } finally {
      setActionLoading(actionId, false);
    }
  }, [onRestore]);

  const handleDelete = useCallback(async (id: string) => {
    if (!onDelete) return;
    
    Alert.alert(
      'Delete Bulletin',
      'Are you sure you want to delete this bulletin? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const actionId = `delete-${id}`;
            setActionLoading(actionId, true);
            
            try {
              await onDelete(id);
            } catch (error) {
              console.error('Error deleting bulletin:', error);
              Alert.alert('Error', 'Failed to delete bulletin');
            } finally {
              setActionLoading(actionId, false);
            }
          },
        },
      ]
    );
  }, [onDelete]);

  const showCommentDialog = useCallback((
    action: 'approve' | 'reject',
    id: string,
    onConfirm: (comment: string) => void
  ) => {
    Alert.prompt(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Bulletin`,
      `Please provide a comment for ${action}ing this bulletin:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: (comment) => {
            if (comment) {
              onConfirm(comment);
            }
          },
        },
      ],
      'plain-text'
    );
  }, []);

  const handleApproveWithComment = useCallback((id: string) => {
    showCommentDialog('approve', id, (comment) => {
      handleApprove(id, comment);
    });
  }, [showCommentDialog, handleApprove]);

  const handleRejectWithComment = useCallback((id: string) => {
    showCommentDialog('reject', id, (comment) => {
      handleReject(id, comment);
    });
  }, [showCommentDialog, handleReject]);

  return {
    // Action handlers
    handlePin,
    handleUnpin,
    handleApprove,
    handleReject,
    handleArchive,
    handleRestore,
    handleDelete,
    handleApproveWithComment,
    handleRejectWithComment,
    
    // Loading states
    isActionLoading,
    loadingActions,
    
    // Utility functions
    showCommentDialog,
  };
};
