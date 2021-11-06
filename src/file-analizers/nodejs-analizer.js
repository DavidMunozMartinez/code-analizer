import fs from 'fs';
import path from 'path';
import { getContentWithinClosure, getLineFromContent } from '../common-utils.js';

/**
 * Retuns data from a NodeJS file project
 * @param {string} fileName File name
 * @param {string} directory Path to that file including itself
 */
export function NodeJSAnalizer(fileName, directory) {
  const fileData = {};
  let content = fs.readFileSync(directory, 'utf8');
  let extension = path.extname(fileName);
  if (extension.toLowerCase() !== '.js') {
    return;
  } 
  fileData['name'] = fileName;
  fileData['at'] = directory;

  let routes = getRoutes(content);
  fileData['routes'] = routes;
  if (routes.length === 0) {
    return;
  }

  return fileData;
}

/**
 * From a NodeJS file returns all instances of a get, put, delete, post, update route
 * @param {string} content Full file content
 */
function getRoutes(content) {
  let routesRegExp = new RegExp(/\b(app\.get|app\.put|app\.delete|app\.post|app\.update)\b(.*)/, 'g');
  const routes = [];
  let result;
  do {
    result = routesRegExp.exec(content);
    if (result) {
      let implementation = getContentWithinClosure('(', ')', content, result.index, true);
      if (implementation.indexOf('\'\'') === -1) {
        routes.push({
          implementation: implementation,
          line: getLineFromContent(content, result[0])
        });
      }
    }
  } while (result);

  return routes;
}