import fs from 'fs';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { recurseDirectory } from './common-utils.js';
import { 
  ANGULAR_ANALIZER_ID,
  AngularAnalizer,
  isValidAngularProject
} from './file-analizers/angular-analizer.js';
import { 
  NODEJS_ANALIZER_ID,
  NodeJSAnalizer,
  isValidNodeJSProject
} from './file-analizers/nodejs-analizer.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express()
const port = 3000;

// This object holds specific code analizers
const analizers = {
  [ANGULAR_ANALIZER_ID]: {
    validatePath: isValidAngularProject,
    tokenizePath: AngularAnalizer
  },
  [NODEJS_ANALIZER_ID]: {
    validatePath: isValidNodeJSProject,
    tokenizePath: NodeJSAnalizer
  }
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, '../public')));

app.listen(port, () => {
  console.log(`Running at http://localhost:${port}`)
});

app.post('/analize', (request, response) => {
  let root = request.body.source;
  let component = request.body.component;
  let type = request.body.type;

  // Make sure root path exists and the type is part of our analizers
  if (!fs.existsSync(root) || !type || !analizers[type]) {
    response.send(false);
  }
  else {
    let collection = [];
    // Recurses all files from given root
    let analizer = getProperAnalizer(type);
    if (analizer) {
      let validRoot = analizer.validatePath(root);
      if (validRoot) {
        if (validRoot.newRoot) root = validRoot.newRoot;
        recurseDirectory(root, (file, directory) => {
          // This data object should be normalized to handle and render more code bases from different languages in the front end
          let data = analizer.tokenizePath(file, directory, component);
          if (data) collection.push(data);
        });
        response.send(collection);
      }
    }
    
  }
});

function getProperAnalizer(id) {
  if (id && analizers[id] && analizers[id].validatePath && analizers[id].tokenizePath) {
    return analizers[id];
  }
  return;
}