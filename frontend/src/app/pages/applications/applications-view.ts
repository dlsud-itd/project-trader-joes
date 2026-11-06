/** List or Board, kept in the URL as `?view=board` so it can be linked. */
export enum ApplicationsView {
  LIST = 'list',
  BOARD = 'board',
}

/** The query parameter that holds the view. */
export const VIEW_PARAM = 'view';

/** Query string that opens the Board view. */
export const BOARD_VIEW_QUERY = `${VIEW_PARAM}=${ApplicationsView.BOARD}`;
