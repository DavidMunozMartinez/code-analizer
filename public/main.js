(function () {
  const sourceInput = document.getElementById('source');
  const componentInput = document.getElementById('component');
  const searchInput = document.getElementById('search');
  const searchInputContainer = document.getElementById('search-container');
  const options = document.getElementsByName('tabs');

  let type = 'ANGULAR';
  let ocurrencesCount = 0;
  let requestInProgress = false;

  function init() {
    let lastSource = localStorage.getItem('source');
    let lastComponent = localStorage.getItem('component');
    if (lastSource) {
      sourceInput.value = lastSource;
    }
    if (lastComponent) {
      componentInput.value = lastComponent;
    }

    searchInput.onclick = () => requestProjectAnalizis(sourceInput.value, componentInput.value);
    options.forEach((option) => option.onchange = (event) => {
      event.target.checked ? type = event.target.id.toUpperCase() : null;
      componentInput.parentElement.classList.toggle('hide');
    });

    [sourceInput, componentInput, searchInput].forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.keyCode === 13 || event.which === 13) {
          requestProjectAnalizis(sourceInput.value, componentInput.value);
        }
      });
    });
  }

  function requestProjectAnalizis() {
    if (!canMakeRequest()) {
      return;
    }
  
    searchInputContainer.classList.toggle('loading');
    makeRequest((result) => {
      if (result) {
        render(result);
        cache(source, component);
      }
      else {
        alert(`Couldn't find path, for relative paths make sure the path is correctly relative to the index.js file in the root folder of this project`)
      }
      searchInputContainer.classList.toggle('loading');
    });
  }

  /**
   * Appends the given array of file data to the results element in dom
   * @param {Array} files Array of file data objects
   */
  function render(files) {
    ['results', 'results-data'].forEach(selector => {
      document.getElementById(selector).innerHTML = '';
    });

    if (files.length === 0) {
      return results.append((makeEl('span', '0 results', ['file-name'])))
    }

    asyncForEach(files, 30)
      .next((file) => {
        let element = listItemElement(file);
        results.append(element);
      })
      .first(() => {
        console.log('first execution');
      })
      .last(() => {
        console.log('last execution');
      });

      let resultsData = document.getElementById('results-data');
      let ocurrencesElement = makeEl('span', ocurrencesCount + ' results in ', ['ocurrence-count']);
      resultsData.append(ocurrencesElement);
      let fileCount = makeEl('span', files.length + ' files', ['file-count']);
      resultsData.append(fileCount);

  }

  /**
   * Creates a dom element with the processes file data
   * @param {Object} fileData File data object
   */
  function listItemElement(fileData) {
    let container = makeEl('div', '', ['list-item']);
    let name = makeEl('div', fileData.name, ['name', 'file-name']);
    container.append(name);

    if (fileData.classes) angularFileData(fileData, container);

    if (fileData.routes) {
      container.append(makeEl('span', fileData.routes.length, ['file-name']));
      container.append(ocurrenceListElement(fileData.routes));
    };
    return container;
  }

  /**
   * Processeses all file data for anguler projects
   * @param {Object} fileData File data object
   * @param {HTMLElement} container HTML list element container
   */
  function angularFileData(fileData, container) {
    fileData.classes.forEach(($class) => {
      let classContainer = makeEl('div', '', ['class-container']);
      let descriveClass = describeClassElement($class, fileData.name);
      let ocurrenceList = ocurrenceListElement($class.implementations);
      classContainer.append(...[descriveClass, ocurrenceList]);
      container.append(classContainer);
    });
  }

  /**
   * This function was made overly complicated and unreadable for fun.
   * @param {*} $class Object
   * @returns container element with a description of the passed tokenized class
   */
  function describeClassElement($class, fileName) {
    let container =  makeEl('div', '', ['basic-data'])
    container.append(...[[$class.className, ['token', 'class-name']],
    [' uses the instance of ', []],
    [componentInput.value + ' ', ['token', 'class-name']],
    [$class.implementations.length, ['file-name']],
    [$class.implementations.length > 1 ? ' times ' : ' time ', []],
    ['as ', []],
    [$class.referencedAs, ['token']]
  ].map(values => makeEl('span', values[0], values[1])));
    return container;
  }
 
  /**
   * Returns a list type of element that goes inside the list-item element
   * @param {Array} ocurrences Array of results in a list
   */
  function ocurrenceListElement(ocurrences) {
    let ocurrencesElement = makeEl('div', '', ['ocurrences-list']);
    ocurrencesCount += ocurrences.length;

    ocurrences.forEach((ocurrence) => {
      let lineNumber = makeEl('span', ocurrence.line, ['line-numbers']);
      let implementation = makeEl('pre', '', ['language-javascript']);
      let code = makeEl('code', ocurrence.implementation, ['language-javascript']);
      Prism.highlightElement(implementation);
      Prism.highlightElement(code);

      implementation.append(lineNumber);
      implementation.append(code);
      ocurrencesElement.append(implementation);

    });

    return ocurrencesElement;
  }

  /**
   * Stores in local storage user input data to suggest next time
   * @param {string} source User input source path
   * @param {string} component Optional component to look for in angular projects
   */
  function cache(source, component) {
    localStorage.setItem('source', source);
    localStorage.setItem('component', component);
  }

  /**
   * Creates and return an HTML element
   * @param {string} el HTML tag
   * @param {string} text HTML inner text
   * @param {Array} classList Class list for element
   */
  function makeEl(el, text, classList) {
    let element = document.createElement(el);
    element.innerHTML = text;
    classList.forEach(c => element.classList.add(c));
    return element;
  }

  // Another unnecessary overly complicated "Class", for fun
  function asyncForEach(iterate, delay) {
    let that = this;
    this.next = (onNext) => {
      that._next = onNext;
      iterate.forEach((item, index) => {
        setTimeout(() => {
          if (index === 0) this._first(item);
          if (index === iterate.length -1) this._last();
          that._next(item, index);
        }, delay * index);
      });
      return that;
    }
    this.last = (onLast) => {
      that._last = onLast;
      return that;
    }
    this.first = (onFirst) => {
      that._first = onFirst;
      return that;
    };

    return that;
  }

  function canMakeRequest() {
    return !!sourceInput.value 
      && (type === 'ANGULAR' && !!componentInput.value)
      && !requestInProgress;
  }

  function makeRequest(cb) {
    let xhr = new XMLHttpRequest();
    xhr.open("POST", '/analize', true);
    xhr.setRequestHeader("Content-Type", "application/json");    
    xhr.onreadystatechange = function() {
        if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
          if (cb) cb(JSON.parse(this.response));
        }
    }
    xhr.send(JSON.stringify({
      source: sourceInput.value,
      component: componentInput.value,
      type: type
    }));
  }

  init();
})();