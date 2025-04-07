importScripts('dist/PayHelper.js')

// replace 'sample-extension' with the ID of
// the extension you registered on www.payhelper.top. You may
// need to uninstall and reinstall the extension.
// And don't forget to change the ID in popup.js too!
var payHelper = PayHelper('sample-extension'); 
payHelper.startBackground(); // this line is required to use ExtPay in the rest of your extension

payHelper.getUser().then(user => {
	console.log(user)
})