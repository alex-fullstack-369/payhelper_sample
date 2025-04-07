# PayHelper.js — Monetize browser extensions with payments
The JavaScript library for [PayHelper.top](https://www.payhelper.top), a service to easily add payments to browser extensions. 

```js
// Example code
// your-extension/background.js
const payHelper = PayHelper('your-extension-id');
payHelper.startBackground();

payHelper.getUser().then(user => {
    if (user.paid) {
        // ...
    } else {
        payHelper.openPaymentPage()
    }
})
```

Below are directions for using this library in your browser extension. This library uses [Mozilla's webextension-polyfill library](https://github.com/mozilla/webextension-polyfill) internally for compatability across browsers which means it should work on almost all modern browsers.

  1. [Install](#1-install)
  2. [Configure your `manifest.json`](#2-configure-your-manifestjson)
  3. [Add `PayHelper.` to `background.js` (required!)](#3-add-PayHelper.-to-backgroundjs-required)
  4. [Use `payHelper.getUser()` to check a user's paid status](#4-use-extpaygetuser-to-check-a-users-paid-status)
      * [`user` object properties](#user-object-properties)
  5. [Use `payHelper.openPaymentPage()` to let the user pay](#5-use-extpayopenpaymentpage-to-let-the-user-pay)
  6. [Use `payHelper.onPaid.addListener()` to run code when the user pays](#6-use-extpayonpaidaddlistener-to-run-code-when-the-user-pays)
  7. [Use `payHelper.openPaymentPage()` to let the user manage their subscription](#7-use-extpayopenpaymentpage-to-let-the-user-manage-their-subscription)
  8. [Use `payHelper.openLoginPage()` to let the user log in if they've paid already](#8-use-extpayopenloginpage-to-let-the-user-log-in-if-theyve-paid-already)

**Note**: PayHelper.js doesn't contain malware or track your users in any way. This library only communicates with PayHelper.top servers to manage users' paid status.

If you like this library, please star it! ⭐️ It helps us out :)

## 1. Install
Copy the [dist/PayHelper.js](dist/PayHelper.js) file into your project (or [PayHelper.module.js](dist/PayHelper.module.js) for ESM / [PayHelper.common.js](dist/PayHelper.common.js) for Common JS). 



## 2. Configure your `manifest.json`
PayHelper. needs the following configuration in your `manifest.json` (for both manifest v2 and v3):

```json
{
    "permissions": [
      "storage"
    ]
}
```

PayHelper. will not show a scary permission warning when users try to install your extension.

Note: For Firefox, you may have to include `"https://www.payhelper.top/*"` in your extension manifest's "permission" for PayHelper. to work properly.

If you have a `"content_security_policy"` in your manifest or get a `Refused to connect to 'https://api.payhelper.top...'` error, you'll have to add `connect-src https://api.payhelper.top` to your extension's content security policy. <a href="https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy">See Mozilla's documentation for more details</a>.


## 3. Add `PayHelper` to `background.js` (required!)

You need to put `PayHelper` in your background file, often named something like `background.js`. If you don't include `PayHelper` in your background file it won't work correctly. If you're using a bundler you can `import 'PayHelper'` or `require('PayHelper')` right in your `background.js`.

With either Manifest V3 or Manifest V2 you'll need to **[sign up and register an extension](https://www.payhelper.top)**. When you register an extension you'll create an extension id that you'll use when initializing `PayHelper`. We'll use `sample-extension` as the extension id in the following examples.

### Manifest V3

```json
{
    "background": {
        "service_worker": "background.js"
    }
}
```

```js
// background.js

importScripts('PayHelper.js') // or `import` / `require` if using a bundler

var payHelper = PayHelper('sample-extension'); // Careful! See note below
payHelper.startBackground(); 
```

**Note about service workers**: In the example above `PayHelper` will become undefined when accessed in service worker callbacks. To use `PayHelper.` in service worker callbacks, redeclare it like so:

```js
chrome.storage.local.get('foo', function() {
    var payHelper = PayHelper('sample-extension');
    // ...
})
```
Make sure not to use `payHelper.startBackground()` in callbacks — it should only be called once.

### Manifest V2

If you're not using a bundler, add `PayHelper.js` to `manifest.json`:
```json
{
    "background": {
        "scripts": ["PayHelper.js", "background.js"]
    }
}
```


```js
// background.js
const payHelper = PayHelper('sample-extension')
payHelper.startBackground();
```




## 4. Use `payHelper.getUser()` to check a user's paid status

This method makes a network call to get the extension user's paid status and returns a `user` object.
```js
payHelper.getUser().then(user => {
    if (user.paid) {
        // ...
    } else {
        // ...
    }
})
```
or use `await`:
```js
async function foo() {
    const user = await payHelper.getUser();
    if (user.paid) {
        // ...
    }
}
```
It is possible for `payHelper.getUser()` to throw an error in case of a network failure. Please consider this possibility in your code e.g. `payHelper.getUser().then(/* ... */).catch(/* handle error */)`

The `user` object returned from `payHelper.getUser()` has the following properties:

### `user` object properties
| property | description |
| --- | --- |
| `user.paid` | `true` or `false`. `user.paid` is meant to be a simple way to tell if the user should have paid features activated. For subscription payments, `paid` is only true if `subscriptionStatus` is `active`. |
| `user.paidAt` | `Date()` object that the user first paid or `null`.|
| `user.email` | The user's email if there is one or `null`.|
| `user.installedAt` | `Date()` object the user installed the extension. |

## 5. Use `payHelper.openPaymentPage()` to let the user pay

Opens a new browser tab where the user can pay to upgrade their status.
```js
payHelper.openPaymentPage()
```

Note: `payHelper.openPaymentPage()` can fail to open the tab if there is a network error. Please consider this possibility in your code.

While developing your extension in test mode, you will need to enter your account password in order to proceed to the Stripe Checkout page. This is to prevent fraudulent access to your extension. You can use [Stripe's test cards](https://docs.stripe.com/testing) in order to test the payment experience in development.

It is best to open the payment page when the user has a clear idea of what they're paying for.

Depending on how you configure your extension, users that have paid before can log in to activate their paid features on different browsers, profiles, or after uninstalling/reinstalling.

You should turn on as many [payment methods in your Stripe settings](https://dashboard.stripe.com/settings/payment_methods) as possible to maximize your revenue.

Also see [our guide for how to create coupon / discount codes for your extensions](/docs/discount_code_guide.md).

## 6. Use `payHelper.onPaid.addListener()` to run code when the user pays

If you want to run some code when your user pays for the first time, use `payHelper.onPaid.addListener()`:

```js
payHelper.onPaid.addListener(user => {
    console.log('user paid!')
})
```

To use this feature, you will need to include the following content script configuration in your `manifest.json`:

```json
{
    "content_scripts": [
        {
            "matches": ["https://www.payhelper.top/*"],
            "js": ["PayHelper.js"],
            "run_at": "document_start"
        }
    ]
}
```

The content script is required to enable `payHelper.onPaid` callbacks. It will add a permissions warning when installing your extension. If you're using a bundler, you can create a file called something like `PayHelper_content_script.js` that only contains `import 'PayHelper'` or `require('PayHelper')` and use that in the `"js"` field above.

You can add as many callback functions as you want.

Note: `onPaid` callbacks will be called after a user pays as well as after a user "logs in" (e.g. activates their paid account on a different browser/profile/install). This may change in the future -- if you'd like this to work differently, please contact me with a detailed explanation of your use case :)


## 7. Use `payHelper.openPaymentPage()` to let the user manage their subscription

If your extension is configured for subscription payments, you should let the user manage/cancel their subscription from within the extension with the same function you used to let them pay:

```js
payHelper.openPaymentPage()
```


## 8. Use `payHelper.openLoginPage()` to let the user log in if they've paid already

A page will open that will allow the user to enter the email they paid with to receive a magic login link. This page can also be accessed through the normal payment screen.
