import { eventHandler, getQuery } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { MOCK_MENU_LIST } from '~/utils/mock-data';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

const pathMap: Record<string, any> = { '/': 0 };

function getPaths(modules: any[]) {
  modules.forEach((module) => {
    pathMap[module.path] = String(module.id);
    if (module.children) {
      getPaths(module.children);
    }
  });
}
getPaths(MOCK_MENU_LIST);

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const { id, path } = getQuery(event);

  return (path as string) in pathMap &&
    (!id || pathMap[path as string] !== String(id))
    ? useResponseSuccess(true)
    : useResponseSuccess(false);
});
