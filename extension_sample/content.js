/*
 * This is an example of how you would add PayHelper to a content script.
 * PayHelper is made available in this script through the manifest.json
 * "content_scripts" -> "js" array.
 */
var payHelper = PayHelper('sample-extension'); 

// Add a "subscribe to Sample Extension!" button on every webpage.
var button = document.createElement('button');
button.innerText = 'Pay for Sample Extension!'
button.addEventListener('click', function(evt) {
	payHelper.openPaymentPage();
}, true)

document.body.prepend(button);