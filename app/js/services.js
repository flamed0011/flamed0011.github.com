"use strict";

/*
 * Services can be defined as : "value", "service", "factory", "provider", or "constant".
 *
 * For simplicity only example of "value" and "service" are shown here. 
 */

// EXAMPLE OF CORRECT DECLARATION OF SERVICE AS A VALUE
myApp.value('version', '0.1');

// EXAMPLE OF CORRECT DECLARATION OF SERVICE
// here is a declaration of simple utility function to know if an given param is a String.
myApp.service("UtilSrvc", function () {
    return {
        isAString: function(o) {
            return typeof o == "string" || (typeof o == "object" && o.constructor === String);
        },
        helloWorld : function(name) {
        	var result = "Hum, Hello you, but your name is too weird...";
        	if (this.isAString(name)) {
        		result = "Hello, " + name;
        	}
        	return result;
        }
    }
});

myApp.service("GithubUserService", function (GithubAuthService) {
	return {
        user : function() {
        	var user = GithubAuthService.github().getUser();
            user.show('', function(err, res) {
                console.log(res);
            });
        }
    }
});

myApp.service("GithubAuthService", function () {
	return {
		github : function() {
			var oauthToken = localStorage.getItem("oauthToken");
			if(oauthToken != "undefined" && oauthToken != null) {
				console.log("oauthToken is available");
				github = new Github({
					token: oauthToken,
					auth: "oauth"
				});
				return github;
			} else {
				console.log("oauthToken is not available or not valid");
				alert("Did you login via github? Otherwise you can connect via Basic Authentication... Please provide a username and password...")
				return null;
			}
		}
    }
});

myApp.service("GithubSrvc", function (GithubUserService, GithubAuthService) {
    return {
        helloGithub : function() {
        	var result = GithubUserService.user();
        	return result;
        }
    }
	
	// the service should be responsible for
	// - check if a token is available
	// - if a token is available get user information
	// - update "Login with github" to match the username
	// - try a commit to the repository
	// - if the commit is successfull it's the admin user
	// - else it's a guest user
});
