export const WORKSPACE_VIEWS = ['globe', 'markets', 'watchlist', 'advanced', 'methodology'] as const;
export type WorkspaceView = typeof WORKSPACE_VIEWS[number];
export function workspaceViewFromHash(hash: string): WorkspaceView {
  const candidate = hash.replace(/^#/, '');
  return WORKSPACE_VIEWS.includes(candidate as WorkspaceView) ? candidate as WorkspaceView : 'globe';
}
