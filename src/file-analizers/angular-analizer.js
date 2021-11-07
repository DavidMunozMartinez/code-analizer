import path from 'path';
import fs from 'fs';
import { getContentWithinClosure, trim, getLineFromContent } from '../common-utils.js'; 

export const ANGULAR_ANALIZER_ID = 'ANGULAR';

/**
 * @param {string} fileName File name
 * @param {string} directory path to file including itself
 * @param {string} component component references that we are looking for
 */
export function AngularAnalizer(fileName, directory, component) {
  const fileData = {};
  let content = fs.readFileSync(directory, 'utf8');
  let extension =  path.extname(fileName);
  if (extension.toLowerCase() !== '.ts') {
    return;
  }

  let imports = getFileImports(content);
  if (!importsComponent(imports, component)) {
    return;
  }
  fileData['name'] = fileName;
  fileData['at'] = directory;

  let classes = getClassesData(content);
  fileData['classes'] = [];
  classes.forEach(($class) => {
    let isPartOfConstructor = isInConstructor($class, component);
    if (isPartOfConstructor) {
      $class.referencedAs = getComponentRefFromConstructor($class, component).reference;
      $class.implementations = getImplementationsFromClass($class, content);
      fileData['classes'].push($class);
    }
  });

  return fileData;
}

/**
 * Defines if a given root folder contains a valid angular project
 * @param {string} root Path to angular project
 */
export function isValidAngularProject(root) {
  let containsCoreDeps = containsAngularCoreDeps(root);
  let angularConfigFile = containsAngularConfigFile(root);
  let sourcePath = angularConfigFile.projects[angularConfigFile.defaultProject].sourceRoot;
  root = path.join(root, sourcePath);
  if (containsCoreDeps && angularConfigFile) {
    return {
      newRoot: root
    };
  }
  return false;
}

function containsAngularCoreDeps(root) {
  let packageJSON = path.join(root, './package.json');
  let packageContent = fs.readFileSync(packageJSON, 'utf8');
  let packageData = JSON.parse(packageContent);
  let deps = packageData.dependencies || {};
  return !!(deps['@angular/common'] && deps['@angular/core'] && deps['@angular/compiler']);
}

function containsAngularConfigFile(root) {
  let angularConfig = path.join(root, './angular.json');
  let angularConfigContent = fs.readFileSync(angularConfig);
  let angularConfigData = JSON.parse(angularConfigContent);

  let defaultProject = angularConfigData.defaultProject;
  let project = angularConfigData.projects[defaultProject];
  let sourceRoot = project.sourceRoot;

  return angularConfigData;
}

/**
 * Crunches a full file content and returns all its imports
 * @param {string} content All the contents of the file in UFT8 format
 */
function getFileImports(content) {
  let regexImports = new RegExp('\\b(import)\\b(.*)', 'g');
  let imports = [];
  let $import;
  do {
    $import = regexImports.exec(content);
    if ($import) {
      let data = getImportData($import, content);
      if (data) {
        imports.push({
          from: data.from,
          list: data.list
        });
      }
    }
  } while ($import);
  return imports;
}

/**
 * From a given array of tokenized imports returns a boolean value that determines
 * if the component we are looking for is part of given array.
 * @param {Array} imports Array of tokenized imports from a file
 * @param {string} component Specific component that we are looking for
 */
function importsComponent(imports, component) {
  let _importsComponent = false;
  for (let i = 0; i < imports.length; i++) {
    let $import = imports[i];
    if ($import.list.indexOf(component) > -1) {
      _importsComponent = true;
      break;
    }
  }
  return _importsComponent;
}

/**
 * Takes all the content from a file and returns basic data from all the classes that are defined
 * within the file
 * @param {string} content Full file content as a string
 */
function getClassesData(content) {
  const classesData = [];
  let classesRegExp = new RegExp('\\b(export class )\\b', 'g');

  let classFound;
  do {
    classFound = classesRegExp.exec(content);
    if (classFound) {
      let classData = getClassData(content, classFound.index);
      classesData.push(classData);
    }
  } while (classFound);

  return classesData;
}

/**
 * Searches trough a tokenized class constructor for a given type 
 * @param {Object} $class Tokenized class that includes constructor and content data
 * @param {string} type Class that we are looking for
 */
function isInConstructor($class, type) {
  let result = false;
  $class.constructor.forEach((arg) => {
    if (arg.type === type) result = true;
  });
  return result;
}

/**
 * Gets component reference from constructor
 * @param {Object} $class Tokenized class object
 * @param {string} type Class name we are looking for
 */
function getComponentRefFromConstructor($class, type) {
  return $class.constructor.find((args) => args.type === type);
}

/**
 * Given a tokenized class object returns all its implementations in a Class definition
 * @param {Object} $class Tokenized class Object
 * @param {string} fullcontent File content
 */
function getImplementationsFromClass($class, fullcontent) {
  let content = $class.content;
  let reference = $class.referencedAs;
  let findImplementationsRegExp = RegExp(`(?<=this\.${reference}\.)(.*)`, 'g');
  let result;
  let implementations = [];
  let closeCondition = (char) => { char === ';' }
  do {
    result = findImplementationsRegExp.exec(content);
    if (result) {
      let implementation = `this.${reference}.${getContentWithinClosure('(', ')', content, result.index, true, closeCondition)}`;
      implementations.push({
        implementation: implementation,
        line: getLineFromContent(fullcontent, `this.${reference}.${result[0]}`)
      });
    }

  } while (result);

  return implementations;
}

/**
 * From an import regex result return a tokenized import
 * @param {string} $import Import line from file content
 * @param {string} content full file content
 */
function getImportData($import, content) {
  let index = $import.index;
  let quotes = [false];
  let importedList = '';
  let importedFrom = '';
  let closure = false;

  importedList = getContentWithinClosure('{', '}', content, index, false, (char) => {
    return char === '\'' || char === '"';
  });

  importedList = importedList
    .replace(/ /g, '')
    .split(',');;

  if (importedList.length == 1 && importedList[0] === '') {
    return null;
  }

  closure = false;
  while (quotes.length > 0 && content[index]) {
    if (content[index] === '\'' || content[index] === '"') {
      closure = true;
      quotes[0] ? quotes.pop() : quotes = [true];
    }
    else if (closure) importedFrom += content[index];
    index++;
  }

  return {
    list: importedList,
    from: importedFrom
  }
}

/**
 * Returns tokenized class data
 * @param {string} content Class content as string
 * @param {number} index Starting index from content
 */
function getClassData(content, index) {
  const data = {};
  let classContent = getContentWithinClosure('{', '}', content, index, true);
  let classConstructorContent = getContentWithinClosure('(', ')', classContent, classContent.indexOf('constructor'));
  let className = classContent.split('{')[0].split(' ')[2];
  let constructorData = getContructorData(classConstructorContent);
  data['className'] = className;
  data['constructor'] = constructorData;
  data['content'] = classContent;
  return data;
}

/**
 * Given a constructor string, returns tokenized data from that contructor
 * @param {string} constructorContent String of a class constructor
 */
function getContructorData(constructorContent) {
  let constructorArgs = constructorContent.split(',');
  return constructorArgs
    .map((arg) => {
      let scope = 'public';
      let component = '';
      let reference = '';
      let argData = arg.split(':');
      if (argData.length === 1) {
        return;
      }   
      component = argData[1];
      let refData = argData[0].split(' ');
      reference = refData[refData.length - 1];
      scope = refData[refData.length - 2] ? refData[refData.length - 2] : scope; 
      scope;

      return {
        type: trim(component),
        reference: trim(reference),
        scope: trim(scope)
      };
    })
    .filter((arg) => !!arg);
}