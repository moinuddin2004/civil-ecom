import { Children, type ReactNode } from 'react';

/**
 * Wraps each child in an `<li>` so grids and rails can take plain cards as children and still be
 * real lists. `Children.map` keeps each child's key on its wrapper. Empty children are dropped.
 */
export function toListItems(children: ReactNode, itemClassName?: string): ReactNode {
  return Children.map(children, (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') return null;
    return <li className={itemClassName}>{child}</li>;
  });
}
