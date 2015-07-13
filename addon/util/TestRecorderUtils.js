//todo do everything without jquery

//todo have a way to load in different code generators for protractor, etc
import emberQUnit from '../codeGenerators/EmberQUnit';
import mutationUtils from 'ember-cli-test-recorder/util/MutationUtils';


export default {

  updateCodeCallback: null,//callback to the component to set the code, we need this here so we can tie into the framework we are automating
  generatedTestCode: "", //this is sent to what ever wants to receive generated code
  lastRoute: "",
  MUTATIONS_PLACEHOLDER: "[MUTATIONS_PLACEHOLDER]", //holds text to be added from mutations

  ui: null,//holds the screen for the code


  /**
   * Wires up everything
   * @param rootDomNode
   * @param updateCodeCallback //the only reason for this is so we can update the ember component or protractor
   */
  setupAll: function (rootDomNode, uiDomNode) {
    this.ui = uiDomNode;
    this.setUpChangeListeners();
    this.setUpClickListeners();
    this.setUpOtherListeners();
    //this will iterate through this node and watch for changes and store them until we want to display them
    mutationUtils.addObserverForTarget(rootDomNode);
    this.setGeneratedScript(emberQUnit.initialCode());
  },

  setGeneratedScript: function (code) {
    this.generatedTestCode = code;
    //todo perhaps use Object.observe once FF supports it
    this.ui.innerHTML = '<pre>' + this.generatedTestCode + '</pre>';
  },
  appendToGeneratedScript: function (code) {
    this.generatedTestCode += code;
    //todo perhaps use Object.observe once FF supports it
    this.ui.innerHTML = '<pre>' + this.generatedTestCode + '</pre>';
  },

  setUpOtherListeners: function () {

    var self = this;

    /**
     * this is used for capturing text input fill-ins
     */
    $('input').on('focusout', function (e) {

        if (e.target.localName === 'input' && e.target.type === 'text') {
          let newCode = emberQUnit.inputTextEdited(self.getPlaybackPath(e), e.target.value);
          //add to existing tests
          self.appendToGeneratedScript(newCode);
        } else {
          return;
        }

      }
    );
  },

  setUpChangeListeners: function () {
    document.addEventListener("change", (e)=> {
      //setsUpSelect input watching
      if (e.target.localName === "select") {
        let newSelectedIndex = e.target.selectedIndex;
        let newCode = emberQUnit.selectChange(this.getPlaybackPath(e), newSelectedIndex);
        this.appendToGeneratedScript(newCode);
      }
    });

//todo native history/hashchange watching
    /*

     window.addEventListener("hashchange", function(e){
     console.log("hash");
     alert("hash");
     });

     window.onpushstate = function () {
     alert("push");

     };
     window.onpopstate= function () {
     alert("pop");

     };
     */

  },

  /**
   * handle simple click events here, not things like selects, date pickers etc
   * //todo consider wrapping mutations code in timeout to give async ops time
   */
  setUpClickListeners: function () {

    var self = this;

    document.addEventListener('click', function (e) {

      if (e.target.localName === 'input' && e.target.type === 'text' || //on listen to focus-out for these
        e.target.localName === 'html' ||  //don't want to record clicking outside the app'
        e.target.localName === 'pre' || //don't want to recorded the output code'
        e.target.type === 'select-one') { // so listen to clicks on select inputs, we handle this with triggers
        return;
      }

      //clear this if not DOM mutations happen ()
      var cleanText = self.generatedTestCode.replace(self.MUTATIONS_PLACEHOLDER, "");
      var newGeneratedScript = cleanText;


      var $target = $(e.target);
      // we don't want to output a click (#ember123) as this is not reliable
      var hasEmberIdRegex = /ember[\d]+/;
      var pathPrint;
      if (e.target.id && !hasEmberIdRegex.test(e.target.id)) {
        pathPrint = "#" + e.target.id;
      } else {
        //print the nasty DOM path instead, to avoid give your element its own id
        pathPrint = $target.path();
      }


      var newTestPrint = 'click("' + pathPrint + '");<br/>' + 'andThen(function () {' + '<br/>';

      //TEST 1 - > Assert the route is what it a changed to, if it changed
      //todo this needs to be looked at again as it assumes the route can only change after a click event
      newTestPrint += emberQUnit.routeChanged();

      //TEST 2 - > Place holder that will be replaced with dom visibility Assertions
      // the last one of these is replaced each time the mutation observes are run
      newTestPrint += self.MUTATIONS_PLACEHOLDER + '<br/>' +
          //Close the and then block
        '});<br/><br/>';
      // console.log(testLinePrint);

      //add to exisiting tests
      newGeneratedScript += newTestPrint;


      //todo make async, because the click event happens after mutations then we can immediately put this in, this should be put
      //in after after a user defined time period to allow server operations that take time
      var withReplacement = newGeneratedScript.replace(self.MUTATIONS_PLACEHOLDER, mutationUtils.pendingGeneratedDomChangedScript);
      self.setGeneratedScript(withReplacement);
      mutationUtils.pendingGeneratedDomChangedScript = "";
    });

  },

  /**
   *
   * @param e event from the DOM that we want to workout the testing path.
   */
  getPlaybackPath: function (e) {
    let hasEmberIdRegex = /ember[\d]+/;
    if (e.target.id && !hasEmberIdRegex.test(e.target.id)) {
      return "#" + e.target.id;
    } else {

      //todo non jquery way of dom path
      //print the nasty DOM path instead, to avoid give your element its own id
      /*      let NUM_QUNIT_WRAPPER_DIVS = 4;//we will ignore these as this path will select relative to the qunit container
       let p = e.path.reverse().slice(NUM_QUNIT_WRAPPER_DIVS).map((o)=> {
       return o.localName ;
       })
       .join('>');
       return p;*/


      return $(e.target).path();
    }
  }
//[].indexOf.call(child.parentNode, child)

};

/**
 * This is a helper function extension of jquery to give us a dynamic path incase the user hasn't given an
 * interactive element an ID. We then use  this path to repeat the user action in a test case.
 */
$.fn.extend({
  path: function () {

    if (this.length !== 1) {
      throw 'Requires one element.';
    }

    var path, node = this;
    //this is just to get the path if the user interacts with a non user given id object
    //we stop at body as qunit tests  find statement is relative to the #ember-testing div
    while (node.length && node[0].localName !== 'body') {
      var realNode = node[0], name = realNode.localName;
      if (!name) {
        break;
      }
      name = name.toLowerCase();

      var parent = node.parent();

      var siblings = parent.children(name);
      if (siblings.length > 1) {
        name += ':eq(' + siblings.index(realNode) + ')';
      }

      path = name + (path ? '>' + path : '');
      node = parent;
    }

    return path;
  }
});


