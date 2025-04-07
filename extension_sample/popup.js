// Replace 'sample-extension' with the id of the extension you
// registered on www.payhelper.top to test payments. You may need to
// uninstall and reinstall the extension to make it work.
// Don't forget to change the ID in background.js too!
const payHelper = PayHelper('sample-extension') 

document.querySelector('button').addEventListener('click', function(evt) {
    evt.preventDefault();
    payHelper.openPaymentPage();
})

payHelper.getUser().then(user => {
    if (user.paid) {
        document.querySelector('p').innerHTML = 'User has paid! 🎉'
        document.querySelector('button').remove()
    }
}).catch(err => {
    document.querySelector('p').innerHTML = "Error fetching data :( Check that your PayHelper id is correct and you're connected to the internet"
})
  