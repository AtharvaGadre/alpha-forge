export const WORKSPACE_VIEWS = ['home', 'globe', 'markets', 'watchlist', 'advanced', 'research', 'accuracy', 'report', 'methodology'] as const;
export type WorkspaceView = typeof WORKSPACE_VIEWS[number];
/** Empty, unknown and retired hashes land on the public home page; every workspace has a stable deep link. */
export function workspaceViewFromHash(hash: string): WorkspaceView {
  const candidate = hash.replace(/^#/, '');
  return WORKSPACE_VIEWS.includes(candidate as WorkspaceView) ? candidate as WorkspaceView : 'home';
}
