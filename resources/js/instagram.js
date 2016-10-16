var app = angular.module("bc-instagram", ["ngRoute"]);

app.config(function ($routeProvider) {
    $routeProvider.when("/alerts", {
        templateUrl: "/templates/alerts.html"
    }).when("/suggestions", {
        templateUrl: "/templates/suggestions.html"
    }).when("/profile/:userName", {
        templateUrl: "/templates/profile.html"
    }).otherwise({
        templateUrl: '/templates/feed.html'
    });
});

app.controller('bc-instagram-controller', function ($scope, $rootScope, $routeParams, $http, $route, $q, $filter) {
    $http.get('/currentUser').success(function (data) {
        $scope.currentUser = data;
        console.dir(data);
    }).error(function () {
        alert('Unable to load currentUser: ' + error);
    });

    $scope.currentUserName = function () {
        if ($scope.currentUser) {
            return $scope.currentUser.firstName + ' ' +
                ($scope.currentUser.middleName ? $scope.currentUser.middleName + ' ' : '') +
                $scope.currentUser.lastName;
        } else {
            return "HACKER";
        }
    };

    $scope.getTemplate = function (path) {

        path = path.substr('/templates/'.length);
        path = path.substr(0, path.length - ".html".length);
        return path;
    };

    $scope.followUser = function (followingUserName) {
        $http.post('/follow', {
            userToFollow: followingUserName
        }).success(function (data) {
            $scope.suggestions = $scope.suggestions.filter(function (suggestion) {
                return suggestion.user.userName !== followingUserName;
            });
            console.dir($scope.suggestions);
        })
    };


    /**
     * Tests whether the profile should be loaded as read-only
     */
    $scope.getProfileReadOnly = function () {

        if ($scope.profileUser && $scope.currentUser) {
            return $scope.profileUser.userName !== $scope.currentUser.userName;
        }
        else {
            return true;
        }
    };

    $scope.onClickFileUpload = function (fileInputElementId, description) {
        var formData = new FormData();
        formData.append('image', document.getElementById(fileInputElementId).files[0]);
        formData.append('description', description);

        $http.post("/post", formData, {
            transformRequest: angular.identity,
            headers: { 'Content-Type': undefined }
        })
            .success(function (response) { location.reload(true); })
            .error(function (response) { alert(response); });
    };

    $scope.onClickDeletePost = function(postId) {
        $http.get("/delete-post/" + postId, null)
            .success(function (response) { location.reload(true); })
            .error(function (response) { alert(response.isSuccess); });
    };
    
    $scope.getProfileNotReadOnly = function() {
        return !$scope.getProfileReadOnly();
    };

    $scope.formatDate = function (dt) {
        return $filter('date')(dt, "medium");
    };

    $scope.userProfileLink = function (user) {
        return '<a href="#/profile/' + user.userName + '">' + user.firstName + ' ' +
            (user.middleName ? user.middleName + ' ' : '') + 
            user.lastName + '</a>';
    };

    $scope.getAlertDescription = function(alert) {
        switch (alert.description) {
            case 'New User':
                return 'You joined Instagram at ' + $scope.formatDate(alert.actionDate);
            case 'New Post':
                if (alert.actor.userName === $scope.currentUser.userName) {
                    return 'You added a <a href="#/post/' + alert.postId + '">new post</a> on ' + $scope.formatDate(alert.actionDate);
                } else {
                    return $scope.userProfileLink(alert.actor) + ' added a <a href="#/post/' + alert.postId + '">new post</a> on ' + $scope.formatDate(alert.actionDate);
                }
            case 'Follow':
                return 'Follow';
            case 'Like':
                return 'Like';
            default:
                return alert.description + ' at ' + $scope.formatDate(alert.actionDate);
        } 
    };

    $scope.$on('$viewContentLoaded', function (event) {

        var view = $scope.getTemplate($route.current.templateUrl);

        if (view === "alerts")
        {
            $http.get('/getAlerts', {cache: false}).success(function(data) {
                $scope.alerts = data;
                console.dir(data);
            });

        }
        else if (view === "suggestions") {
            $http.get("/suggestions/" + $scope.currentUser.userName, { cache: false }).success(function (data) {
                $scope.suggestions = data;
            });
        }
        else if (view === "profile") {
            if (!$routeParams.userName) {
                $routeParams.userName = $scope.currentUser.userName;
            }

            // Load profile here
            //setTimeout(function() {
            // $http.get("/profile/" + $routeParams.userName).success(function (data) {
            //     var profileUser = data;
            //     $http.get("/get-followers").success(function (data) {
            //         var userFollowers = data;
            //         $http.get("/get-followings").success(function (data) {
            //             $scope.profileUser = profileUser;
            //             $scope.followers = userFollowers;
            //             $scope.followings = data;

            //         });

            //     });

            // });
            //}, 500);

            // $http.get("/profile/" + $routeParams.userName, { cache: false }).success(function (data) {
            //     console.log("profile: ", data);
            //     $scope.profileUser = data;
            // }).then("/get-followings", { cache: false }).success(function (data) {
            //     console.log("followings: ", data);
            //     $scope.followings = data;
            // }).then("/get-followers", { cache: false }).success(function (data) {
            //     console.log("followers: ", data);
            //     $scope.followers = data;
            // });

            var profile = $http.get("/profile/" + $routeParams.userName, { cache: false });
            var followings = $http.get("/get-followings", { cache: false });
            var followers = $http.get("/get-followers", { cache: false });

            $q.all([profile, followings, followers])
                .then(function (valueArray) {
                console.log("data: ", valueArray);
                    $scope.profileUser = valueArray[0].data;
                    $scope.followings = valueArray[1].data;
                    $scope.followers = valueArray[2].data;
                });
        }
        else if (view === "feed") {
            $http.get("/get-posts", { cache: false }).success(function (data) {
                console.dir(data);
                $scope.posts = data;
                console.dir(data);
            });
        }
    });
});

/*
var loadUserProfile = function (userName) {

    $('div#userName').text(userName);

    var profile;

    $.ajax('/profile/' + userName, {
        async: true,
        cache: false,
        dataType: 'json',
        method: 'GET',
        success: function (data) {
            loadProfileData(data);
            loadUserTweets(userName);
        },
        error: function (jqXhr, status, error) {
            alert('Unable to load profile: ' + error);
        }
    });
};

var loadProfileData = function (profile) {

    if (profile) {
        var user = profile.user;

        if (user.userName === $('#currentUser').val()) {
            // load for update
            $('input#firstName').val(user.firstName);
            $('input#middleName').val(user.middleName);
            $('input#lastName').val(user.lastName);
            $('input#firstName').show();
            $('input#middleName').show();
            $('input#lastName').show();
            $('div#firstName').hide();
            $('div#middleName').hide();
            $('div#lastName').hide();
            $('#updateProfileButton').show();
        }
        else {
            // load for display
            $('div#firstName').text(user.firstName);
            $('div#middleName').text(user.middleName);
            $('div#lastName').text(user.lastName);
            $('input#firstName').hide();
            $('input#middleName').hide();
            $('input#lastName').hide();
            $('div#firstName').show();
            $('div#middleName').show();
            $('div#lastName').show();
            $('#updateProfileButton').hide();
        }
    }

    $('#followers-div').text('');

    if (profile.followers && profile.followers.length) {
        for (var i = 0; i < profile.followers.length; i++) {
            $('#followers-div').append("<div>" + profile.followers[i].userName + "</div>");
        }
    }
    else {
        $('#followers-div').html("<strong>You don't have any followers, but <em>I</em> love you!</strong>");
    }

    $('#following-div').follower({
        following: profile.following,
        userName: profile.user.userName
    });
};

var loadHtml = function (url, cb) {

    $.ajax(url, {
        cache: false,
        method: 'GET',
        dataType: 'html',
        error: function (jqXhr, status, err) {
            alert('Unable to load url ' + url + ': ' + err);
        },
        success: function (html) {
            $('#appContent').html(html);

            if (cb) {
                cb();
            }
        }
    });
};
*/