/**
 * Shared utility for checking if a route is active
 * Supports exact matches, sub-routes, and dynamic routes with :id patterns
 */
export function isActiveRoute(
  currentLocation: string,
  mainRoute: string,
  subRoutes: string[] = []
): boolean {
  // Exact match with main route
  if (currentLocation === mainRoute) return true;
  
  // Check if location starts with main route (for nested routes like /analysis/current)
  if (currentLocation.startsWith(mainRoute + '/')) return true;
  
  // Check exact matches with sub-routes
  if (subRoutes.some(subRoute => currentLocation === subRoute)) return true;
  
  // Check if location starts with any of the base routes (for dynamic routes like /analysis/:id/full)
  return subRoutes.some(subRoute => {
    if (subRoute.includes(':')) {
      // Handle dynamic routes by checking prefix
      const baseRoute = subRoute.split('/:')[0];
      return currentLocation.startsWith(baseRoute + '/');
    }
    return false;
  });
}
