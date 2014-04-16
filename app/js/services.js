"use strict";

/*
 * Services can be defined as : "value", "service", "factory", "provider", or "constant".
 *
 * For simplicity only example of "value" and "service" are shown here. 
 */

// EXAMPLE OF CORRECT DECLARATION OF SERVICE AS A VALUE
myApp.value('version', '0.1');

myApp.service("GithubAuthService", function ($http, $q, UserModel) {
	return {
		instance : function() {
			var github = null;
			// this should ask for the UserModel - user object, and get the token from there...
			// maybe store the instance in localStorage????
			var oauthToken = localStorage.getItem("oauthToken");
			if(oauthToken != "undefined" && oauthToken != null) {
				console.log("oauthToken is available");
                github = new Octokit({
					token: oauthToken,
					auth: "oauth"
				});
				// test the token, if it is still valid... if not,
			} else {
				console.log("oauthToken is not available or not valid");
				console.log("Did you login via github? Otherwise you can connect via Basic Authentication... Please provide a username and password...")
				this.requestToken();
			}
			return github;
		},
		requestCode: function() {
			console.log("Request a new token, the page will be reloaded with code appended to the address...");
			// request a token, this generates a state random string, the string has to be validated after login
			jso_configure({
				"github": {
					client_id: "e5923f3d7f1182fe886f",
					redirect_uri: "http://maltretieren.github.com",
					authorization: "https://github.com/login/oauth/authorize?scope=public_repo"
				}
			});
	
			$.oajax({
				jso_provider: "github",
				jso_allowia: true
			});
		},
        requestToken: function(oauthCode) {
            var that = this;
            $http({method: 'GET', url: 'https://maltretieren.herokuapp.com/authenticate/'+oauthCode}).
                success(function(data, status, headers, config) {
                    if(typeof data.token != 'undefined') {
                        console.log("Yaayy, got a token: "+data.token);
                        localStorage.setItem("oauthToken", data.token);
                        that.userInfo().user();
                    } else {
                        console.log("It was not possible to get a token with the provided code");

                    }
                }).
                error(function(data, status, headers, config) {
                    alert("Error while getting a token for the provided code");
            });
        },
        userInfo: function() {
            var self = this;
            var user = function() {
                var githubInstance = self.instance();
                var user = githubInstance.getUser();
                $q.when(user.getInfo()).then(function(res) {
                    console.log("login successfull: "+res.login);
                    UserModel.login(res.login);
                }, function(err) {
                    console.log("there was an error getting user information, maybe the token is invalid?");
                    // delete the token from localStorage, because it is invalid...
                    GithubAuthService.requestToken();
                });
            };

            return {
                user: function() { return user(); },
                logout: function() { return UserModel.logout(); }
            }
        }
    }
});

myApp.service("GithubSrvc", function (
    $rootScope, $q, $interval, GithubAuthService,
    UserModel, PollingSrvc, ParameterSrvc, $http, $timeout) {

    return {
        // there are different states: token & code provided, token or code, nothing
        helloGithub : function(oauthCode, oauthToken) {
            var oauthCode = ParameterSrvc.urlParams['code'];
            var oauthToken = localStorage.getItem("oauthToken");

            console.log("Token: "+oauthToken);
            console.log("Code: "+oauthCode);

            if(typeof oauthToken != 'undefined' && oauthToken != null && oauthToken != 'undefined') {
                console.log("Token provided, try to use it - Token: "+oauthToken)
                GithubAuthService.userInfo().user();
            } else if(typeof oauthCode === 'undefined' && (typeof oauthToken === 'undefined' || oauthToken === "undefined" || oauthToken === null) ) {
                console.log("nothing (no code, no token) provided, wait until user presses login button");
                // after page reload code is available and it will requestToken()
            } else if(typeof oauthCode != "undefined" && (oauthToken != 'undefined' || oauthToken != null)) {
                console.log("Code provided, no Token, request token - Code: "+oauthCode)
                GithubAuthService.requestToken(oauthCode);
            } else {
                console.log("There is something wrong with the login");
            }
        },
        requestCode: function() {
            GithubAuthService.requestCode();
        },
		fork: function(options) {
            // options contain the name for the new github page and the site slogan
			var githubInstance = GithubAuthService.instance();
			if(githubInstance != null) {
                // this is the name of the original repo
                var repo = githubInstance.getRepo("Maltretieren", "maltretieren.github.com");
                var promise = $q.when(repo.fork());
                return promise;
            } else {
                console.log("no token provided... Please login");
            }
		},
        renameRepo: function(forkName) {
			console.log("rename repo to "+forkName);
            if(!forkName || forkName.length < 5){
				forkName = "flamed0011.github.com"
			}
			
            var that = this;
            var patch = {
                name: forkName
            };
            var githubInstance = GithubAuthService.instance();
            //var userName = UserModel.getUser().name;
            var repo = githubInstance.getRepo("flamed0011", "maltretieren.github.com");
            return $q.when(repo.updateInfo(patch)).then(function(res) {
                console.log("Repository renamed...")
                //that.renameBranch(forkName, "heads/master");
            })
        },
        batchDelete: function(forkName) {
            var githubInstance = GithubAuthService.instance();
            var repo = githubInstance.getRepo("flamed0011", forkName);
            var branch = repo.getBranch("master");

			// polling for the posts dir every second until rename complete,
			// then start delete every second....
			(function tick(path) {
				$q.when(branch.contents(path)).then(function(res) {
					console.log("cleanup of _posts...");
					var i = 0;
					$interval(function() {
						if(res[i].type === "file") {
							branch.remove(res[i].path, "deleted");
						} else {
							console.log(res[i].path + " is a folder - delete the content instead");
							tick(res[i].path);
						}
						i++;
					}, 1500, res.length);
				}, function(err) {
					$timeout(tick("_posts"), 1000);
				});
			})();

        },
        deleteBranch: function(forkName, branchName) {
			var that = this;
			var githubInstance = GithubAuthService.instance();
			var repo = githubInstance.getRepo("flamed0011", forkName);			
			return repo.git.deleteRef(branchName).done(function(result) {
				console.log("deleted branch"+branchName);
				//that.renameBranch(forkName);
			});
        },
        renameBranch: function(forkName) {
			var that = this;
			var githubInstance = GithubAuthService.instance();
			var repo = githubInstance.getRepo("flamed0011", forkName);			
			return repo.git.deleteRef("heads/master").done(function(result) {
				console.log("deleted master branch");
				//that.createBranch(forkName, "master");
			});
        },
        createBranch: function(forkName, branchName) {
			var that = this;
			var githubInstance = GithubAuthService.instance();
			var repo = githubInstance.getRepo("flamed0011", forkName);
			console.log("switch to template branche");
			var branch = repo.getBranch("template");
			var forkName = forkName;
			console.log("create master branch from template");
			return branch.createBranch("master").done(function() {
				console.log("master branch created from template branch");
                branch = repo.getBranch("master");
                var callback = function() {
                    //repo.git.deleteRef("heads/template");
                };
                //PollingSrvc.checkForBranchContent(branch, "README.md", callback);
			});
        },
        postProcess: function() {
            // change page slogan:
            // request _config.yml
            // search/replace "title : Place to pee free!"/"title: slogan)
            // commit
        },
        getContent: function(path) {
            // change page slogan:
            // request _config.yml
            // search/replace "title : Place to pee free!"/"title: slogan)
            // commit
            var self = this;
            var path = path;
            var githubInstance = GithubAuthService.instance();
            var repo = githubInstance.getRepo("Maltretieren", "maltretieren.github.com");

            //console.log(path);
            var branch = repo.getBranch("master");
            var contents = branch.read(path, false)
            contents.done(function(result) {
                //console.log(result.content);
                $('#target-editor').markdown({
                    savable:true,
                    height:500,
                    onSave: function(e) {
                        self.commit(e.getContent(), path)
                    }
                });
                $('#target-editor').show();
                $("#target-editor").val(result.content);
            })
        },
		commit: function(text, path) {
            var githubInstance = GithubAuthService.instance();
			var repo = githubInstance.getRepo("Maltretieren", "maltretieren.github.com");
            var branch = repo.getBranch("masterrrrr");
            console.log(path);
            var contents = {}
            contents["README.md"] = text;

            console.log(contents);
            branch.writeMany(contents, "save").done(function() {
                console.log("saved");
                //window.location = url;
                $rootScope.$broadcast('Toast::githubCommitSuccess');
            });
        },
		goodByeGithub : function() {
			UserModel.logout();
		}
    }
});

// Inspired by http://joelhooks.com/blog/2013/04/24/modeling-data-and-state-in-your-angularjs-application/
myApp.service("UserModel", function ($rootScope) {
	this.user = {};
	this.isAdmin = false;
	this.token = "";
	
	this.login = function(userName) {
		this.loggedIn = true;
		this.user = {
			name: userName
		};
		console.log("send a userLoggedIn event for user: "+userName);
		$rootScope.$broadcast('UserModel::userLoggedIn', userName);
	};
	this.logout = function() {
		this.user = {};
		this.loggedIn = false;
		localStorage.clear();
		console.log("send a userLoggedOut event");
		$rootScope.$broadcast('UserModel::userLoggedOut');
	}
});

/**
 This is a helper function
 **/
myApp.service("ParameterSrvc", function ($window) {
    var urlParams;
    ($window.onpopstate = function () {
        var match,
            pl     = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
            query  = window.location.search.substring(1);

        urlParams = {};
        while (match = search.exec(query))
            urlParams[decode(match[1])] = decode(match[2]);
    })();
    return {
        urlParams: urlParams
    }
});

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

myApp.service("PollingSrvc", function ($q, $timeout, GithubAuthService) {

    var poll = function (repoName, branchName) {
        var resource = "README.md";
        var deferred = $q.defer();
        // poll for availability - implement as promise, resolve as soon as it is available
        var githubInstance = GithubAuthService.instance();
        var repo = githubInstance.getRepo("flamed0011", repoName);
        var branch = repo.getBranch(branchName);
        var repoName = repoName;
        var branchName = branchName;

        var promise = $q.when(branch.read(resource,false));
        promise.then(function(res) {
            console.log("branch available")
            deferred.resolve();
        }, function(err) {
            var restartPolling = function(){
                poll(repoName, branchName)
            }
            $timeout(restartPolling, 2000);
        });

        return deferred.promise;
    };
    return { checkForBranchContent: poll }
});

myApp.service("PollingImgSrvc", function ($q, $timeout) {

    var poll = function (repoName, branchName) {
        var deferred = $q.defer();

        var pollForImg = function() {
            console.log("poll");
            var img = new Image();

            img.onload = function() {
                console.log("yehh");
                deferred.resolve();
            }
            img.onerror = function() {
                console.log("oh noooo");
                var pollForImage = function() {
                    pollForImg();
                }
                $timeout(pollForImage, 50000);
            }
            img.src = "https://flamed0011.github.com/app/img/ping.gif";
        }
        pollForImg();

        return deferred.promise;
    };
    return { checkReady: poll }
});
