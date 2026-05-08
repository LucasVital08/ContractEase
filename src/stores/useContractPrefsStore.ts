import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ContractPrefsStore {
  // Favorites (item 200)
  favorites: string[];
  toggleFavorite: (contractId: string) => void;
  isFavorite: (contractId: string) => boolean;

  // Folders/Labels (item 196-197)
  folders: { id: string; name: string; color: string }[];
  contractFolders: Record<string, string>; // contractId -> folderId
  addFolder: (name: string, color: string) => void;
  removeFolder: (folderId: string) => void;
  moveToFolder: (contractId: string, folderId: string) => void;
  removeFromFolder: (contractId: string) => void;

  // Trash (item 198)
  trash: { contractId: string; deletedAt: string }[];
  moveToTrash: (contractId: string) => void;
  restoreFromTrash: (contractId: string) => void;
  permanentDelete: (contractId: string) => void;
  cleanTrash: () => void; // Remove items older than 30 days
}

export const useContractPrefsStore = create<ContractPrefsStore>()(
  persist(
    (set, get) => ({
      // Favorites (Keeping as empty shell for backward compatibility if needed, or remove completely)
      favorites: [],
      toggleFavorite: () => {},
      isFavorite: () => false,

      // Folders
      folders: [],
      contractFolders: {},
      addFolder: () => {},
      removeFolder: () => {},
      moveToFolder: () => {},
      removeFromFolder: () => {},

      // Trash
      trash: [],
      moveToTrash: (contractId) =>
        set(state => ({
          trash: [...state.trash, { contractId, deletedAt: new Date().toISOString() }],
        })),
      restoreFromTrash: (contractId) =>
        set(state => ({
          trash: state.trash.filter(t => t.contractId !== contractId),
        })),
      permanentDelete: (contractId) =>
        set(state => ({
          trash: state.trash.filter(t => t.contractId !== contractId),
        })),
      cleanTrash: () =>
        set(state => {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          return {
            trash: state.trash.filter(t => t.deletedAt > thirtyDaysAgo),
          };
        }),
    }),
    { name: 'contractease-prefs' }
  )
);
