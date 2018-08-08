const requestPromise  = require("request-promise");
// App functions 

module.exports = {

    // Get current theme published 
    getCurrentTheme(object , callback){
    
        const accessToken           = object.shop.accessToken;
        const apiRequestUrl         = "https://" + object.shop.shopify_domain + "/admin/themes.json";

        const apiRequestHeader = {
            'X-Shopify-Access-Token' : accessToken
        }

        requestPromise.get( apiRequestUrl , { headers : apiRequestHeader } ).
        then( (apiResponse) => {
          const parsedResponseJson = JSON.parse(apiResponse);
          const themes = parsedResponseJson.themes;
          for(var i = 0 ; i < themes.length ; i++){
              if(themes[i].role === "main"){
                const themeId = themes[i].id;
                return new Promise(function(resolve, reject) {
                    callback(resolve, reject);
                })
            }
          }
        });
    }


}
