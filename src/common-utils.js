import fs from 'fs';
import path from 'path';

/**
 * Given its paramters, analizes the content and returns a new string within the given parameters
 * @param {string} opener Closure starter
 * @param {string} closer Closure ender
 * @param {string} content Content to process
 * @param {number} index Starting index relative to content
 * @param {boolean} addWhileLooking Include all character from content starting from index number, regardless of the closure AND or START
 * @param {Function} stopCondition optional function that validates characters to determine of we should stop the content search
 * @returns 
 */
export function getContentWithinClosure(opener, closer, content, index, addWhileLooking, stopCondition) {
  let stack = [null];
  let result = '';
  let closure = false;
  let stop = false;
  do {
    if (content[index] === opener) {
      closure = true;
      stack[0] ? stack.push(opener) : stack = [opener];
      if (addWhileLooking) result += content[index];
    }
    else if (content[index] === closer) {
      stack.pop();
      if (addWhileLooking) result += content[index];
    }
    else if (closure || addWhileLooking) result += content[index];
    index++;

    if (stopCondition && stopCondition(content[index])) stop = true;

  } while (stack.length > 0 && content[index] && !stop);
  return result;
}

/**
 * Given a directory, iterates over all its files recursively, going trough all child folders
 * @param {string} directory Folder directory
 * @param {Function} callback Function to execute per found file
 */
export function recurseDirectory(directory, callback) {
  let items = fs.readdirSync(directory);
  items.forEach((item) => {
    let newDirectory = path.join(directory, item);
    let stats = fs.statSync(newDirectory);

    if (stats.isDirectory()) {
      recurseDirectory(newDirectory, callback);
    }
    if (stats.isFile()) {
      callback(item, newDirectory);
    }
  });
}

/**
 * Given a full path, returns the content of that path if any.
 * @param {string} directory Folder directory
 */
export function getContent(directory) {
  if (fs.existsSync(directory)) {
    return fs.readFileSync(directory);
  }
  return false;
}

/**
 * Returns the same given string without white spaces or line breaks
 * @param {string} val Value to trim
 */
export function trim(val) {
  return val
    .replace(/ /g, '')
    .replace(/\r?\n|\r/, "")
}

/**
 * Returns the line of a given code, relative to a given content
 * @param {string} content Full file content
 * @param {string} implementation code to look for
 */
export function getLineFromContent(content, implementation) {
  let contentLines = content.split('\n');
  let lineNumber = 0;
  for (let i = 0; i < contentLines.length; i++) {
    let line = contentLines[i];
    if (line.indexOf(implementation) !== -1) {
      lineNumber = i + 1;
      break;
    }
  }
  return lineNumber;
}
