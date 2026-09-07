# OPA5 Testing Skills for OpenUI5

## Overview

This skill provides comprehensive testing guidelines for OpenUI5 applications using OPA5 (One Page Acceptance Tests). This guide covers unit tests, integration tests, OPA5 journey tests, and is designed for the Bun.js runtime.

## Table of Contents

1. [OPA5 Fundamentals](#opa5-fundamentals)
2. [Test Structure and Organization](#test-structure-and-organization)
3. [OPA5 Configuration](#opa5-configuration)
4. [Page Objects Pattern](#page-objects-pattern)
5. [Journey Tests](#journey-tests)
6. [Component Integration Tests](#component-integration-tests)
7. [OData Mock Server](#odata-mock-server)
8. [Testing FCL Navigation](#testing-fcl-navigation)
9. [Async Testing](#async-testing)
10. [Test Utilities and Helpers](#test-utilities-and-helpers)
11. [Best Practices](#best-practices)
12. [Bun.js Runtime Specifics](#bunjs-runtime-specifics)

---

## OPA5 Fundamentals

### What is OPA5?

OPA5 (One Page Acceptance Test) is SAP's testing framework for OpenUI5 applications. It provides:

- **Declarative Test Syntax**: Readable, maintainable test code
- **Page Objects**: Reusable test components
- **Journey Tests**: End-to-end user flows
- **Integration with QUnit**: Seamless UI5 integration

### Test Structure

```javascript
// Standard OPA5 test structure
opaTest("Should do something", function(Given, When, Then) {
  // Arrange (Given)
  Given.iStartMyApp();

  // Act (When)
  When.iDoSomething();

  // Assert (Then)
  Then.iShouldSeeSomething();
});
```

---

## Test Structure and Organization

### Directory Structure

```
webapp/test/
├── OPA5/
│   ├── AllJourney.js              # Master test file
│   ├── MasterJourney.js           # Master view tests
│   ├── DetailJourney.js           # Detail view tests
│   ├── NavigationJourney.js       # Navigation tests
│   ├── Arrangements/
│   │   ├── arrangements.js        # Common arrangements
│   │   ├── mockdata.arrangement.js
│   │   └── server.arrangement.js
│   ├── Actions/
│   │   ├── actions.js             # Common actions
│   │   ├── master.actions.js
│   │   └── detail.actions.js
│   ├── Assertions/
│   │   ├── assertions.js          # Common assertions
│   │   ├── master.assertions.js
│   │   └── detail.assertions.js
│   └── Pages/
│       ├── master.page.js         # Page objects
│       ├── detail.page.js
│       └── app.page.js
├── unit/
│   └── controller/
│       ├── App.controller.js      # Unit tests
│       └── Master.controller.js
└── test.html                      # Test runner page
```

---

## OPA5 Configuration

### Test Configuration

```javascript
// webapp/test/OPA5/AllJourney.js
sap.ui.define([
  "sap/ui/test/opaJasmine",
  "test/OPA5/MasterJourney",
  "test/OPA5/DetailJourney",
  "test/OPA5/NavigationJourney"
], function(opaTest) {
  "use strict";

  // OPA5 configuration
  OPA5.extendConfig({
    arragements: new sap.ui.test.opa Arrangements(),
    actions: new sap.ui.test.opa.actions(),
    assertions: new sap.ui.test.opa.assertions(),
    viewNamespace: "com.erdwithai.view.",
    autoWait: true,
    timeout: 15,
    pollingInterval: 400
  });
});
```

### Test Page (test.html)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OPA5 Tests</title>

  <!-- UI5 Bootstrap -->
  <script
    id="sap-ui-bootstrap"
    src="https://openui5.hana.ondemand.com/resources/sap-ui-core.js"
    data-sap-ui-theme="sap_fiori_3"
    data-sap-ui-resourceroots='{
      "com.erdwithai": "../../",
      "test": "./"
    }'
    data-sap-ui-compatVersion="edge"
    data-sap-ui-async="true"
    data-sap-ui-onInit="module:sap/ui/core/Support"
    data-sap-ui-language="en"
    data-sap-ui-xx-waitForTheme="true">
  </script>

  <!-- QUnit -->
  <link rel="stylesheet" href="https://openui5.hana.ondemand.com/resources/sap/ui/thirdparty/qunit-2.css">
  <script src="https://openui5.hana.ondemand.com/resources/sap/ui/thirdparty/qunit-2.js"></script>
  <script src="https://openui5.hana.ondemand.com/resources/sap/ui/thirdparty/qunit-2-css.js"></script>

  <!-- OPA5 -->
  <script src="https://openui5.hana.ondemand.com/resources/sap/ui/test/opaQunit.js"></script>

  <!-- Test Suites -->
  <script>
    sap.ui.require(["test/OPA5/AllJourney"]);
  </script>
</head>
<body>
  <div id="qunit"></div>
  <div id="qunit-fixture"></div>
</body>
</html>
```

---

## Page Objects Pattern

### Base Page Object

```javascript
// webapp/test/OPA5/Pages/app.page.js
sap.ui.define(
  ["sap/ui/test/Opa5", "test/OPA5/Arrangements/arrangements"],
  function(Opa5, arrangements) {
    "use strict";

    var CommonPage = Opa5.extend("test.pages.Common", {
      arrangements: arrangements,

      // Common actions
      actions: {
        iStartTheApp: function() {
          return this.iStartMyUIComponent({
            componentConfig: {
              name: "com.erdwithai",
              manifest: true
            }
          });
        },

        iStopTheApp: function() {
          return this.iTeardownMyUIComponent();
        },

        iWaitUntilTheAppIsStarted: function() {
          return this.waitFor({
            id: "app",
            viewName: "App",
            success: function() {
              Opa5.assert.ok(true, "The app is started");
            },
            errorMessage: "The app did not start"
          });
        }
      },

      // Common assertions
      assertions: {
        iShouldSeeTheApp: function() {
          return this.waitFor({
            id: "app",
            viewName: "App",
            success: function() {
              Opa5.assert.ok(true, "The app is visible");
            },
            errorMessage: "The app is not visible"
          });
        }
      }
    });

    return CommonPage;
  }
);
```

### Master Page Object

```javascript
// webapp/test/OPA5/Pages/master.page.js
sap.ui.define(
  ["sap/ui/test/Opa5", "com/erdwithai/test/OPA5/Pages/app.page"],
  function(Opa5, appPage) {
    "use strict";

    var MasterPage = Opa5.extend("test.pages.Master", appPage, {
      actions: {
        iPressOnTheObjectListItem: function(sItemTitle) {
          return this.waitFor({
            controlType: "sap.m.ObjectListItem",
            matchers: new Opa5.matchers.PropertyStrictEquals({
              name: "title",
              value: sItemTitle
            }),
            success: function(oItem) {
              oItem.$().trigger("tap");
            },
            errorMessage: "No ObjectListItem with title " + sItemTitle + " was found"
          });
        },

        iSearchFor: function(sSearchTerm) {
          return this.waitFor({
            id: "searchField",
            viewName: "Master",
            actions: new sap.ui.test.actions.EnterText({
              text: sSearchTerm
            }),
            errorMessage: "Search field not found"
          });
        },

        iPressTheRefreshButton: function() {
          return this.waitFor({
            id: "pullToRefresh",
            viewName: "Master",
            actions: new sap.ui.test.actions.Press(),
            errorMessage: "Refresh button not found"
          });
        }
      },

      assertions: {
        iShouldSeeTheList: function() {
          return this.waitFor({
            id: "list",
            viewName: "Master",
            success: function() {
              Opa5.assert.ok(true, "The list is visible");
            },
            errorMessage: "The list is not visible"
          });
        },

        iShouldSeeTheListItem: function(sItemTitle) {
          return this.waitFor({
            controlType: "sap.m.ObjectListItem",
            matchers: new Opa5.matchers.PropertyStrictEquals({
              name: "title",
              value: sItemTitle
            }),
            success: function() {
              Opa5.assert.ok(true, "The list item with title " + sItemTitle + " is visible");
            },
            errorMessage: "The list item with title " + sItemTitle + " was not found"
          });
        },

        theListShouldHaveNItems: function(iExpectedCount) {
          return this.waitFor({
            id: "list",
            viewName: "Master",
            success: function(oList) {
              Opa5.assert.strictEqual(
                oList.getItems().length,
                iExpectedCount,
                "The list has " + iExpectedCount + " items"
              );
            },
            errorMessage: "The list does not have " + iExpectedCount + " items"
          });
        },

        theListHeaderShouldShowTheAmountOfEntries: function() {
          return this.waitFor({
            id: "list",
            viewName: "Master",
            success: function(oList) {
              var iExpectedCount = oList.getItems().length;
              var sHeaderTitle = oList.getHeaderToolbar().getTitle();
              Opa5.assert.ok(
                sHeaderTitle.indexOf(iExpectedCount) > -1,
                "The list header shows " + iExpectedCount + " entries"
              );
            },
            errorMessage: "The list header does not show the amount of entries"
          });
        }
      }
    });

    return MasterPage;
  }
);
```

### Detail Page Object

```javascript
// webapp/test/OPA5/Pages/detail.page.js
sap.ui.define(
  ["sap/ui/test/Opa5", "com/erdwithai/test/OPA5/Pages/app.page"],
  function(Opa5, appPage) {
    "use strict";

    var DetailPage = Opa5.extend("test.pages.Detail", appPage, {
      actions: {
        iPressTheBackButton: function() {
          return this.waitFor({
            id: "page",
            viewName: "Detail",
            actions: function(oPage) {
              oPage.$navButton.trigger("tap");
            },
            errorMessage: "The back button was not found"
          });
        },

        iPressTheEditButton: function() {
          return this.waitFor({
            id: "editButton",
            viewName: "Detail",
            actions: new sap.ui.test.actions.Press(),
            errorMessage: "Edit button not found"
          });
        },

        iPressTheDeleteButton: function() {
          return this.waitFor({
            id: "deleteButton",
            viewName: "Detail",
            actions: new sap.ui.test.actions.Press(),
            errorMessage: "Delete button not found"
          });
        }
      },

      assertions: {
        iShouldSeeTheDetailPage: function() {
          return this.waitFor({
            controlType: "sap.m.DynamicPage",
            success: function() {
              Opa5.assert.ok(true, "The detail page is visible");
            },
            errorMessage: "The detail page is not visible"
          });
        },

        iShouldSeeTheObjectTitle: function(sTitle) {
          return this.waitFor({
            controlType: "sap.m.Title",
            matchers: new Opa5.matchers.PropertyStrictEquals({
              name: "text",
              value: sTitle
            }),
            success: function() {
              Opa5.assert.ok(true, "The object title " + sTitle + " is visible");
            },
            errorMessage: "The object title " + sTitle + " was not found"
          });
        },

        iShouldSeeTheBusyIndicator: function() {
          return this.waitFor({
            controlType: "sap.m.BusyIndicator",
            success: function() {
              Opa5.assert.ok(true, "The busy indicator is visible");
            },
            errorMessage: "The busy indicator is not visible"
          });
        }
      }
    });

    return DetailPage;
  }
);
```

---

## Journey Tests

### Master Journey

```javascript
// webapp/test/OPA5/MasterJourney.js
sap.ui.define(
  ["sap/ui/test/OpaJasmine", "test/OPA5/Pages/master.page"],
  function(opaTest, MasterPage) {
    "use strict";

    opaTest("Should see the initial list of items", function(Given, When, Then) {
      // Arrangement
      Given.iStartTheApp();

      // Actions
      When.iWaitUntilTheAppIsStarted();

      // Assertions
      Then.iShouldSeeTheList();
      Then.theListShouldHaveNItems(10);
      Then.theListHeaderShouldShowTheAmountOfEntries();
    });

    opaTest("Should be able to search for items", function(Given, When, Then) {
      // Arrangement is already done from previous test

      // Actions
      When.iSearchFor("Project");

      // Assertions
      Then.iShouldSeeTheListItem("Project 1");
      Then.theListHeaderShouldShowTheAmountOfEntries();
    });

    opaTest("Should navigate to detail when item is pressed", function(Given, When, Then) {
      // Actions
      When.iPressOnTheObjectListItem("Project 1");

      // Assertions
      Then.iShouldSeeTheDetailPage();
      Then.iShouldSeeTheObjectTitle("Project 1");
    });

    opaTest("Should handle pull-to-refresh", function(Given, When, Then) {
      // Actions
      When.iPressTheBackButton();
      When.iPressTheRefreshButton();

      // Assertions
      Then.iShouldSeeTheList();
    });
  }
);
```

### Detail Journey

```javascript
// webapp/test/OPA5/DetailJourney.js
sap.ui.define(
  ["sap/ui/test/OpaJasmine", "test/OPA5/Pages/detail.page", "test/OPA5/Pages/master.page"],
  function(opaTest, DetailPage, MasterPage) {
    "use strict";

    opaTest("Should see the detail page with all information", function(Given, When, Then) {
      // Arrangement
      Given.iStartTheApp();
      When.iPressOnTheObjectListItem("Project 1");

      // Assertions
      Then.iShouldSeeTheDetailPage();
      Then.iShouldSeeTheObjectTitle("Project 1");
    });

    opaTest("Should navigate back to master", function(Given, When, Then) {
      // Actions
      When.iPressTheBackButton();

      // Assertions
      Then.iShouldSeeTheList();
    });

    opaTest("Should show edit dialog", function(Given, When, Then) {
      // Arrangement
      When.iPressOnTheObjectListItem("Project 1");

      // Actions
      When.iPressTheEditButton();

      // Assertions
      Then.iShouldSeeTheDialogWithTitle("Edit Project");
    });
  }
);
```

### Navigation Journey

```javascript
// webapp/test/OPA5/NavigationJourney.js
sap.ui.define(
  ["sap/ui/test/OpaJasmine", "test/OPA5/Pages/master.page", "test/OPA5/Pages/detail.page"],
  function(opaTest, MasterPage, DetailPage) {
    "use strict";

    opaTest("Should navigate from master to detail and back", function(Given, When, Then) {
      // Start
      Given.iStartTheApp();

      // Navigate to detail
      When.iPressOnTheObjectListItem("Project 1");
      Then.iShouldSeeTheDetailPage();

      // Navigate back
      When.iPressTheBackButton();
      Then.iShouldSeeTheList();
    });

    opaTest("Should handle deep linking", function(Given, When, Then) {
      // Start with hash
      Given.iStartTheApp({
        hash: "/Projects/1"
      });

      // Should go directly to detail
      Then.iShouldSeeTheDetailPage();
      Then.iShouldSeeTheObjectTitle("Project 1");
    });
  }
);
```

---

## Component Integration Tests

### OData Mock Server

```javascript
// webapp/test/OPA5/Arrangements/mockdata.arrangement.js
sap.ui.define(
  ["sap/ui/test/opa Arrangements", "sap/ui/core/util/MockServer"],
  function(Arrangements, MockServer) {
    "use strict";

    var oMockServerInterface = Arrangements.extend("test.Arrangements.MockServer", {
      _aMockRequests: [],

      iStartMyApp: function(oOptions) {
        oOptions = oOptions || {};
        var sManifestUrl = oOptions.manifestUrl || "../../manifest.json";

        // Start mock server
        this._startMockServer(sManifestUrl);

        // Start the app UI component
        return this.iStartMyUIComponent({
          componentConfig: {
            name: "com.erdwithai",
            manifest: true
          },
          hash: oOptions.hash,
          autoWait: oOptions.autoWait
        });
      },

      _startMockServer: function(sManifestUrl) {
        var oMockServer = new MockServer({
          rootUri: "/api/odata/"
        });

        // Configure mock requests
        this._configureMockRequests(oMockServer);

        // Start the mock server
        oMockServer.start();

        // Simulate network delay
        MockServer.requests({
          delay: 500
        });

        this.oMockServer = oMockServer;
      },

      _configureMockRequests: function(oMockServer) {
        var oResponse = {
          Projects: [
            {
              ID: 1,
              Name: "Project 1",
              Description: "First project",
              Type: "web",
              CreatedAt: "/Date(2024-01-15T10:30:00Z)/"
            },
            {
              ID: 2,
              Name: "Project 2",
              Description: "Second project",
              Type: "mobile",
              CreatedAt: "/Date(2024-01-16T10:30:00Z)/"
            }
          ]
        };

        oMockServer.simulate(
          oResponse,
          {
            sMockdataBaseUrl: "/api/odata/",
            bGenerateMissingMockData: true
          }
        );
      },

      iStopMyApp: function() {
        this.oMockServer.stop();
        return this.iTeardownMyUIComponent();
      }
    });

    return oMockServerInterface;
  }
);
```

### Custom Arrangement for Specific Tests

```javascript
// webapp/test/OPA5/Arrangements/testdata.arrangement.js
sap.ui.define(
  ["sap/ui/test/opa Arrangements"],
  function(Arrangements) {
    "use strict";

    return Arrangements.extend("test.Arrangements.TestData", {
      iSetTestData: function(sTestId) {
        var aTestData = {
          "empty": [],
          "single": [
            {
              ID: 1,
              Name: "Single Project",
              Description: "Only project"
            }
          ],
          "multiple": [
            {
              ID: 1,
              Name: "Project 1",
              Description: "First project"
            },
            {
              ID: 2,
              Name: "Project 2",
              Description: "Second project"
            }
          ]
        };

        this._oMockServer.setRequests(aTestData[sTestId]);
        return this.waitFor({
          success: function() {
            Opa5.assert.ok(true, "Test data set to " + sTestId);
          }
        });
      }
    });
  }
);
```

---

## Testing FCL Navigation

### FCL Page Object

```javascript
// webapp/test/OPA5/Pages/fcl.page.js
sap.ui.define(
  ["sap/ui/test/Opa5", "com/erdwithai/test/OPA5/Pages/app.page"],
  function(Opa5, appPage) {
    "use strict";

    var FCLPage = Opa5.extend("test.pages.FCL", appPage, {
      actions: {
        iCloseTheMidColumn: function() {
          return this.waitFor({
            id: "closeColumn",
            autoWait: true,
            actions: new sap.ui.test.actions.Press(),
            errorMessage: "Close button in mid column was not found or not clickable"
          });
        },

        iNavigateToTheDetailDetailColumn: function() {
          return this.waitFor({
            controlType: "sap.m.ObjectListItem",
            viewName: "Detail",
            success: function(aItems) {
              aItems[0].$().trigger("tap");
            },
            errorMessage: "ObjectListItem in detail view not found"
          });
        }
      },

      assertions: {
        iShouldSeeTheFCL: function() {
          return this.waitFor({
            id: "fcl",
            success: function() {
              Opa5.assert.ok(true, "The FlexibleColumnLayout is visible");
            },
            errorMessage: "The FlexibleColumnLayout is not visible"
          });
        },

        iShouldSeeTheBeginColumn: function() {
          return this.waitFor({
            id: "fcl",
            success: function(oFCL) {
              var sBeginColumnPages = oFCL.getBeginColumnPages();
              Opa5.assert.ok(
                sBeginColumnPages.length > 0,
                "The begin column is visible"
              );
            },
            errorMessage: "The begin column is not visible"
          });
        },

        iShouldSeeTheMidColumn: function() {
          return this.waitFor({
            id: "fcl",
            success: function(oFCL) {
              var sMidColumnPages = oFCL.getMidColumnPages();
              Opa5.assert.ok(
                sMidColumnPages.length > 0,
                "The mid column is visible"
              );
            },
            errorMessage: "The mid column is not visible"
          });
        },

        iShouldSeeTheEndColumn: function() {
          return this.waitFor({
            id: "fcl",
            success: function(oFCL) {
              var sEndColumnPages = oFCL.getEndColumnPages();
              Opa5.assert.ok(
                sEndColumnPages.length > 0,
                "The end column is visible"
              );
            },
            errorMessage: "The end column is not visible"
          });
        },

        theFCLShouldBeOnTheXColumnsLayout: function(sLayout) {
          return this.waitFor({
            id: "fcl",
            success: function(oFCL) {
              Opa5.assert.strictEqual(
                oFCL.getLayout(),
                sLayout,
                "The FCL is on the " + sLayout + " layout"
              );
            },
            errorMessage: "The FCL is not on the " + sLayout + " layout"
          });
        }
      }
    });

    return FCLPage;
  }
);
```

### FCL Journey Test

```javascript
// webapp/test/OPA5/FCLJourney.js
sap.ui.define(
  ["sap/ui/test/OpaJasmine", "test/OPA5/Pages/fcl.page", "test/OPA5/Pages/master.page"],
  function(opaTest, FCLPage, MasterPage) {
    "use strict";

    opaTest("Should start with two columns on desktop", function(Given, When, Then) {
      // Arrangement
      Given.iStartTheApp();

      // Assertions
      Then.iShouldSeeTheFCL();
      Then.iShouldSeeTheBeginColumn();
      Then.theFCLShouldBeOnTheXColumnsLayout("TwoColumnsBeginExpanded");
    });

    opaTest("Should open detail column when item is selected", function(Given, When, Then) {
      // Actions
      When.iPressOnTheObjectListItem("Project 1");

      // Assertions
      Then.iShouldSeeTheMidColumn();
      Then.theFCLShouldBeOnTheXColumnsLayout("TwoColumnsMidExpanded");
    });

    opaTest("Should close detail column when close button is pressed", function(Given, When, Then) {
      // Actions
      When.iCloseTheMidColumn();

      // Assertions
      Then.iShouldNotSeeTheMidColumn();
      Then.theFCLShouldBeOnTheXColumnsLayout("OneColumn");
    });

    opaTest("Should open three columns on nested navigation", function(Given, When, Then) {
      // Navigate to detail
      When.iPressOnTheObjectListItem("Project 1");

      // Navigate to detail-detail
      When.iNavigateToTheDetailDetailColumn();

      // Assertions
      Then.iShouldSeeTheBeginColumn();
      Then.iShouldSeeTheMidColumn();
      Then.iShouldSeeTheEndColumn();
      Then.theFCLShouldBeOnTheXColumnsLayout("ThreeColumnsMidExpanded");
    });
  }
);
```

---

## Async Testing

### Waiting for Async Operations

```javascript
// Async action
iWaitForTheAsyncOperationToFinish: function() {
  return this.waitFor({
    check: function() {
      var oModel = this.getModel("odata");
      return oModel && !oModel.isBusy();
    }.bind(this),
    success: function() {
      Opa5.assert.ok(true, "Async operation finished");
    },
    errorMessage: "Async operation did not finish in time",
    timeout: 15
  });
},

// Waiting for specific UI state
iWaitForTheBusyIndicatorToDisappear: function() {
  return this.waitFor({
    id: "detailPage",
    viewName: "Detail",
    matchers: function(oPage) {
      return !oPage.getBusy();
    },
    success: function() {
      Opa5.assert.ok(true, "Busy indicator disappeared");
    },
    errorMessage: "Busy indicator did not disappear",
    timeout: 10
  });
},

// Waiting for model data
iWaitForTheModelToBeUpdated: function(sModelName, sPath) {
  return this.waitFor({
    check: function() {
      var oModel = this.getModel(sModelName);
      var oData = oModel.getProperty(sPath);
      return oData !== null && oData !== undefined;
    }.bind(this),
    success: function() {
      Opa5.assert.ok(true, "Model data is available");
    },
    errorMessage: "Model data was not updated",
    timeout: 15
  });
}
```

---

## Test Utilities and Helpers

### Custom Matchers

```javascript
// webapp/test/OPA5/utils/matchers.js
sap.ui.define(
  ["sap/ui/test/matchers/Matcher"],
  function(Matcher) {
    "use strict";

    var PropertyContainsText = Matcher.extend("test.matcher.PropertyContainsText", {
      isMatching: function(oControl) {
        var sProperty = this.sProperty;
        var sExpectedText = this.sExpectedText;
        var sActualText = oControl.getProperty(sProperty);
        return sActualText && sActualText.indexOf(sExpectedText) > -1;
      },

      describe: function() {
        return "whose " + this.sProperty + " contains '" + this.sExpectedText + "'";
      },

      setProperty: function(sProperty) {
        this.sProperty = sProperty;
        return this;
      },

      setExpectedText: function(sExpectedText) {
        this.sExpectedText = sExpectedText;
        return this;
      }
    });

    return PropertyContainsText;
  }
);

// Usage
iShouldSeeAControlWithTextInProperty: function(sText, sProperty) {
  return this.waitFor({
    controlType: "sap.m.Text",
    matchers: new PropertyContainsText()
      .setProperty(sProperty)
      .setExpectedText(sText),
    success: function() {
      Opa5.assert.ok(true, "Found control with " + sProperty + " containing " + sText);
    },
    errorMessage: "No control found with " + sProperty + " containing " + sText
  });
}
```

### Custom Actions

```javascript
// webapp/test/OPA5/utils/actions.js
sap.ui.define(
  ["sap/ui/test/actions/Action"],
  function(Action) {
    "use strict";

    var EnterTextAndFireEvent = Action.extend("test.action.EnterTextAndFireEvent", {
      executeOn: function(oControl) {
        oControl.setValue(this.sText);
        oControl.fireEvent(this.sEvent);
      },

      setText: function(sText) {
        this.sText = sText;
        return this;
      },

      setEvent: function(sEvent) {
        this.sEvent = sEvent;
        return this;
      }
    });

    return EnterTextAndFireEvent;
  }
);
```

### Custom Assertions

```javascript
// webapp/test/OPA5/utils/assertions.js
sap.ui.define(
  ["sap/ui/test/opa Arrangements"],
  function(Arrangements) {
    "use strict";

    var CustomAssertions = Arrangements.extend("test.Assertions.Custom", {
      iShouldSeeTheErrorMessage: function(sMessage) {
        return this.waitFor({
          controlType: "sap.m.MessageStrip",
          matchers: function(oMessageStrip) {
            return oMessageStrip.getText() === sMessage;
          },
          success: function() {
            Opa5.assert.ok(true, "Error message is visible: " + sMessage);
          },
          errorMessage: "Error message not found: " + sMessage
        });
      },

      iShouldSeeNControls: function(sControlType, iExpectedCount) {
        return this.waitFor({
          controlType: sControlType,
          success: function(aControls) {
            Opa5.assert.strictEqual(
              aControls.length,
              iExpectedCount,
              "Found " + iExpectedCount + " " + sControlType + " controls"
            );
          },
          errorMessage: "Did not find " + iExpectedCount + " " + sControlType + " controls"
        });
      },

      iShouldSeeTheToast: function(sMessage) {
        return this.waitFor({
          controlType: "sap.m.MessageToast",
          check: function() {
            var oToast = sap.ui.requireSync("sap/m/MessageToast");
            // This is a simplified check - actual implementation depends on how you access toasts
            return true;
          },
          success: function() {
            Opa5.assert.ok(true, "Toast message is visible");
          },
          errorMessage: "Toast message was not shown"
        });
      }
    });

    return CustomAssertions;
  }
);
```

---

## Best Practices

### Test Organization

```javascript
// Good: Descriptive test name
opaTest("Should display project list when app starts", function(Given, When, Then) {
  Given.iStartTheApp();
  Then.iShouldSeeTheList();
});

// Bad: Vague test name
opaTest("Test 1", function(Given, When, Then) {
  // ...
});
```

### Test Independence

```javascript
// Good: Each test is independent
opaTest("Should show empty list", function(Given, When, Then) {
  Given.iSetTestData("empty");
  When.iStartTheApp();
  Then.theListShouldHaveNItems(0);
});

opaTest("Should show single item", function(Given, When, Then) {
  Given.iSetTestData("single");
  When.iStartTheApp();
  Then.theListShouldHaveNItems(1);
});

// Bad: Tests depend on each other
opaTest("First test sets up data", function(Given, When, Then) {
  Given.iStartTheApp();
  When.iCreateANewProject();
});

opaTest("Second test assumes data exists", function(Given, When, Then) {
  // This will fail if run independently
  Then.iShouldSeeTheProjectCreatedInPreviousTest();
});
```

### Proper Cleanup

```javascript
// Always clean up after tests
opaTest("Should navigate to detail", function(Given, When, Then) {
  Given.iStartTheApp();
  When.iPressOnTheObjectListItem("Project 1");
  Then.iShouldSeeTheDetailPage();
  // Cleanup
  Then.iStopTheApp();
});
```

---

## Bun.js Runtime Specifics

### Running OPA5 Tests with Bun

```javascript
// package.json
{
  "scripts": {
    "test:opa5": "bun test --browser",
    "test:opa5:watch": "bun test --browser --watch",
    "test:opa5:coverage": "bun test --browser --coverage"
  }
}
```

### Bun Test Configuration

```javascript
// bun.test.config.js
module.exports = {
  testMatch: [
    "**/test/OPA5/**/*.js"
  ],
  browser: {
    headless: true,
    slow: 1000
  }
};
```

---

## Additional Resources

- [OPA5 Documentation](https://openui5.hana.ondemand.com/topic/8878d70b49b3418ba5f45a6c62cd3ee9)
- [UI5 Testing](https://openui5.hana.ondemand.com/topic/162ef2b068e541e3a5086c914483b03c)
- [QUnit Documentation](https://qunitjs.com)