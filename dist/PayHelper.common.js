'use strict';

var browser = require('webextension-polyfill');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var browser__namespace = /*#__PURE__*/_interopNamespace(browser);

// Sign up at https://www.payhelper.top to use this library. AGPLv3 licensed.

// For running as a content script. Receive a message from the successful payments page
// and pass it on to the background page to query if the user has paid.
if (typeof window !== "undefined") {
  window.addEventListener(
    "message",
    (event) => {
      if (event.origin !== "https://api.payhelper.top" && event.origin !== "http://localhost:5173") return;
      if (event.source != window) return;
      if (event.data === "fetch-user" || event.data === "trial-start") {
        browser__namespace.runtime.sendMessage(event.data);
      }
    },
    false
  );
}

function PayHelper(extension_id) {
  const HOST = `https://api.payhelper.top`;
  const PAGE_HOST = `http://localhost:5173`;
  const EXTENSION_API_URL = `${HOST}/api/payhelper/${extension_id}`;
  const EXTENSION_PAGE_URL = `${PAGE_HOST}/sdk`;

  function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function get(key) {
    try {
      return await browser__namespace.storage.sync.get(key);
    } catch (e) {
      // if sync not available (like with Firefox temp addons), fall back to local
      return await browser__namespace.storage.local.get(key);
    }
  }

  async function set(dict) {
    try {
      return await browser__namespace.storage.sync.set(dict);
    } catch (e) {
      // if sync not available (like with Firefox temp addons), fall back to local
      return await browser__namespace.storage.local.set(dict);
    }
  }

  async function fetchWithLogging(url, options = {}, errInfo = "") {
    try {
      console.log(`Fetching: ${url}`, options);

      const response = await fetch(url, options);
      if (!response.ok) {
        throw errInfo;
      }

      const data = await response.json();

      console.log(`Response from ${url}:`, data);

      return data.data;
    } catch (error) {
      console.error(`Fetch error for ${url}:`, error);
      throw error;
    }
  }

  // ----- start configuration checks
  browser__namespace.management &&
    browser__namespace.management.getSelf().then(async (ext_info) => {
      if (!ext_info.permissions.includes("storage")) {
        var permissions = ext_info.hostPermissions.concat(ext_info.permissions);
        throw `PayHelper Setup Error: please include the "storage" permission in manifest.json["permissions"] or else PayHelper won't work correctly.

You can copy and paste this to your manifest.json file to fix this error:

"permissions": [
    ${permissions.map((x) => `"    ${x}"`).join(",\n")}${permissions.length > 0 ? "," : ""}
    "storage"
]
`;
      }
    });
  // ----- end configuration checks

  // run on "install"
  get(["payhelper_installed_at", "payhelper_user"]).then(async (storage) => {
    if (storage.payhelper_installed_at) return;

    // Migration code: before v2.1 installedAt came from the server
    // so use that stored datetime instead of making a new one.
    const user = storage.payhelper_user;
    const date = user ? user.installedAt : new Date().toISOString();
    await set({ payhelper_installed_at: date });
  });

  const paid_callbacks = [];
  const trial_callbacks = [];

  async function create_key() {
    var body = {};
    var ext_info;
    if (browser__namespace.management) {
      ext_info = await browser__namespace.management.getSelf();
    } else if (browser__namespace.runtime) {
      ext_info = await browser__namespace.runtime.sendMessage("payhelper-extinfo"); // ask background page for ext info
      if (!ext_info) {
        // Safari doesn't support browser.management for some reason
        const is_dev_mode = !("update_url" in browser__namespace.runtime.getManifest());
        ext_info = { installType: is_dev_mode ? "development" : "normal" };
      }
    } else {
      throw "PayHelper needs to be run in a browser extension context";
    }

    if (ext_info.installType == "development") {
      body.development = true;
    }

    const api_key = await fetchWithLogging(
      `${EXTENSION_API_URL}/apikey/create`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
      `PayHelper: Error generating key. Are you sure you registered your extension on payhelper.top? Check at this URL and make sure the ID matches '${extension_id}':${HOST}/home`
    );
    await set({ payhelper_api_key: api_key });
    return api_key;
  }

  async function get_key() {
    const storage = await get(["payhelper_api_key"]);
    if (storage.payhelper_api_key) {
      return storage.payhelper_api_key;
    }
    return null;
  }

  const datetime_re = /^\d\d\d\d-\d\d-\d\dT/;

  async function fetch_user() {
    var storage = await get(["payhelper_user", "payhelper_installed_at"]);
    const api_key = await get_key();
    if (!api_key) {
      return {
        paid: false,
        paidAt: null,
        installedAt: storage.payhelper_installed_at ? new Date(storage.payhelper_installed_at) : new Date(), // sometimes this function gets called before the initial install time can be flushed to storage
        trialStartedAt: null,
      };
    }

    const user_data = await fetchWithLogging(
      `${EXTENSION_API_URL}/user?api_key=${api_key}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
      "PayHelper error while fetching user"
    );
    if (!user_data) {
      return {
        isPaid: false,
        isTrial: false,
        installedAt: storage.payhelper_installed_at ? new Date(storage.payhelper_installed_at) : new Date(), // sometimes this function gets called before the initial install time can be flushed to storage
        trialStartedAt: null,
      };
    }

    const parsed_user = {};
    for (var [key, value] of Object.entries(user_data)) {
      if (value && value.match && value.match(datetime_re)) {
        value = new Date(value);
      }
      parsed_user[key] = value;
    }
    parsed_user.installedAt = new Date(storage.payhelper_installed_at);

    if (parsed_user.paidAt) {
      if (!storage.payhelper_user || (storage.payhelper_user && !storage.payhelper_user.paidAt)) {
        paid_callbacks.forEach((cb) => cb(parsed_user));
      }
    }
    if (parsed_user.trialStartedAt) {
      if (!storage.payhelper_user || (storage.payhelper_user && !storage.payhelper_user.trialStartedAt)) {
        trial_callbacks.forEach((cb) => cb(parsed_user));
      }
    }
    await set({ payhelper_user: user_data });

    return parsed_user;
  }

  async function open_popup(url, width, height) {
    if (browser__namespace.windows && browser__namespace.windows.create) {
      const current_window = await browser__namespace.windows.getCurrent();
      // https://stackoverflow.com/a/68456858
      const left = Math.round((current_window.width - width) * 0.5 + current_window.left);
      const top = Math.round((current_window.height - height) * 0.5 + current_window.top);
      try {
        browser__namespace.windows.create({
          url: url,
          type: "popup",
          focused: true,
          width,
          height,
          left,
          top,
        });
      } catch (e) {
        // firefox doesn't support 'focused'
        browser__namespace.windows.create({
          url: url,
          type: "popup",
          width,
          height,
          left,
          top,
        });
      }
    } else {
      // for opening from a content script
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/open
      window.open(
        url,
        null,
        `toolbar=no,location=no,directories=no,status=no,menubar=no,width=${width},height=${height},left=450`
      );
    }
  }

  async function open_payment_page() {
    var api_key = await get_key();
    if (!api_key) {
      api_key = await create_key();
    }
    const url = `${EXTENSION_PAGE_URL}/pay/${extension_id}?api_key=${api_key}`;
    open_popup(url, 500, 800);
  }

  async function open_trial_page(period) {
    // let user have period string like '1 week' e.g. "start your 1 week free trial"

    var api_key = await get_key();
    if (!api_key) {
      api_key = await create_key();
    }
    var url = `${EXTENSION_PAGE_URL}/trial/${extension_id}?api_key=${api_key}`;
    if (period) {
      url += `&period=${period}`;
    }
    open_popup(url, 500, 700);
  }

  async function open_login_page() {
    var api_key = await get_key();
    if (!api_key) {
      api_key = await create_key();
    }
    const url = `${EXTENSION_PAGE_URL}/login/${extension_id}?api_key=${api_key}`;
    open_popup(url, 500, 800);
  }

  var polling = false;

  async function poll_user_paid() {
    // keep trying to fetch user in case stripe webhook is late
    if (polling) return;
    polling = true;
    var user = await fetch_user();
    for (var i = 0; i < 2 * 60; ++i) {
      if (user.paidAt) {
        polling = false;
        return user;
      }
      await timeout(1000);
      user = await fetch_user();
    }
    polling = false;
  }

  return {
    getUser: function () {
      return fetch_user();
    },
    onPaid: {
      addListener: function (callback) {
        const content_script_template = `"content_scripts": [
                {
            "matches": ["${HOST}/*"],
            "js": ["PayHelper.js"],
            "run_at": "document_start"
        }]`;
        const manifest = browser__namespace.runtime.getManifest();
        if (!manifest.content_scripts) {
          throw `PayHelper setup error: To use the onPaid callback handler, please include PayHelper as a content script in your manifest.json. You can copy the example below into your manifest.json or check the docs: https://github.com/Glench/PayHelper#2-configure-your-manifestjson

        ${content_script_template}`;
        }
        const payhelper_content_script_entry = manifest.content_scripts.find((obj) => {
          // removing port number because firefox ignores content scripts with port number
          return obj.matches.includes(HOST.replace(":8080", "") + "/*");
        });
        if (!payhelper_content_script_entry) {
          throw `PayHelper setup error: To use the onPaid callback handler, please include PayHelper as a content script in your manifest.json matching "${HOST}/*". You can copy the example below into your manifest.json or check the docs: https://github.com/Glench/PayHelper#2-configure-your-manifestjson

        ${content_script_template}`;
        } else {
          if (!payhelper_content_script_entry.run_at || payhelper_content_script_entry.run_at !== "document_start") {
            throw `PayHelper setup error: To use the onPaid callback handler, please make sure the PayHelper content script in your manifest.json runs at document start. You can copy the example below into your manifest.json or check the docs: https://github.com/Glench/PayHelper#2-configure-your-manifestjson

        ${content_script_template}`;
          }
        }

        paid_callbacks.push(callback);
      },
      // removeListener: function(callback) {
      //     // TODO
      // }
    },
    openPaymentPage: open_payment_page,
    openTrialPage: open_trial_page,
    openLoginPage: open_login_page,
    onTrialStarted: {
      addListener: function (callback) {
        trial_callbacks.push(callback);
      },
    },
    startBackground: function () {
      browser__namespace.runtime.onMessage.addListener(function (message, sender, send_response) {
        console.log("service worker got message! Here it is:", message);
        if (message == "fetch-user") {
          // Only called via payhelper.top/extension/[extension-id]/paid -> content_script when user successfully pays.
          // It's possible attackers could trigger this but that is basically harmless. It would just query the user.
          poll_user_paid();
        } else if (message == "trial-start") {
          // no need to poll since the trial confirmation page has already set trialStartedAt
          fetch_user();
        } else if (message == "payhelper-extinfo" && browser__namespace.management) {
          // get this message from content scripts which can't access browser.management
          return browser__namespace.management.getSelf();
        }
      });
    },
  };
}

module.exports = PayHelper;
