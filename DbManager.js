const dbFileName = "bc-instagram.sqlite";
const sqlCreateTableFileName = "create_tables.sql";

var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(dbFileName);

var fs = require("fs");

var init = false;

// all DB prepare statements
// READ-ONLY statements
const READ_POST_SQL = `SELECT p.post_id, p.post_date, p.description, u.user_name AS author_user_name, 
                              u.first_name AS author_first_name, u.middle_name AS author_middle_name, 
                              u.last_name AS author_last_name, p.mime_type, p.encoding, p.file_name, 
                              p.file_size 
                       FROM post AS p 
                       INNER JOIN user AS u
                            ON p.author = u.user_name `;

const READ_SUGGESTION_SQL = `SELECT     u.user_name, 
                                        u.first_name, 
                                        u.middle_name, 
                                        u.last_name, 
                                        (SELECT group_concat(p.post_id) 
                                         FROM post AS p
                                         WHERE p.author = u.user_name 
                                         ORDER BY p.post_id DESC 
                                         LIMIT 3) AS post_ids
                             FROM user AS u `;
const FIND_SUGGESTIONS_PS = READ_SUGGESTION_SQL + 
                            'WHERE u.user_name != $userName and u.user_name not in (select following_user_name from user_follow where user_name = $userName)';

const FIND_USER_PS = "SELECT user_name, first_name, middle_name, last_name FROM user WHERE user_name = ? and password = ?";
const FIND_USER_BY_USERNAME_PWD_PS = "SELECT user_name, first_name, middle_name, last_name FROM user WHERE user_name = ? and password = ?";
const FIND_POST_BY_ID_PS = READ_POST_SQL + 'WHERE p.post_id = ?';
const FIND_POST_BY_USER_PS = "SELECT post_id, post_date, description, author, image, type FROM post WHERE author = ?";
const FIND_POST_LIKE_COUNT_BY_POST_ID_PS = "SELECT count(*) FROM post_like WHERE post_id = ?";
const FIND_POST_COMMENTS_BY_POST_ID_PS = "SELECT post_commnet_id, post_id, user_name, comment_text, comment_date FROM post_comment WHERE post_id = ?";
const FIND_FOLLOWER_COUNT_BY_USER_PS = "SELECT count(*) FROM user_follow WHERE user_name = ?";
const FIND_FOLLOWING_COUNT_BY_USER_PS = "SELECT count(*) FROM user_follow WHERE following_user_name = ?";
const FIND_FOLLOWER_LIST_BY_USER_PS = "SELECT user_name, first_name, middle_name, last_name FROM user WHERE user_name in " +
    "(SELECT following_user_name FROM user_follow WHERE user_name = ?)";
const FIND_FOLLOWING_LIST_BY_USER_PS = "SELECT user_name, first_name, middle_name, last_name FROM user WHERE user_name in " +
    "(SELECT user_name FROM user_follow WHERE following_user_name = ?)";

const READ_POST_IMAGE_PS = `SELECT image, file_name, mime_type, encoding, file_size 
                            FROM post 
                            WHERE post_id = $postId`;

// CREATE/INSERT prepare statements
const CREATE_USER_PS = "INSERT INTO user (user_name, password, first_name, middle_name, last_name) VALUES (?, ?, ?, ?, ?)";
const CREATE_USER_FOLLOW_PS = "INSERT INTO user_follow (user_name, following_user_name) VALUES (?, ?)";
const CREATE_POST_PS = "INSERT INTO post " +
    "(post_date, description, author, image, mime_type, encoding, file_name, file_size) " +
    "values ($postDate, $description, $author, $image, $mimeType, $encoding, $fileName, $fileSize)";
const CREATE_POST_COMMENT_PS = "INSERT INTO post_comment (post_id, username, comment_text, comment_date) values (?, ?, ?, ?)";
const CREATE_POST_LIKE_PS = "INSERT INTO post_like (post_id, username) values (?, ?)";
const DELETE_POST_PS = "DELETE FROM post WHERE post_id = ? AND author = ?";

// UPDATE prepare statements
const UPDATE_USER_PS = "UPDATE user SET first_name = ?, middle_name = ?, last_name = ? WHERE user_name = ?";

// DELETE prepare statements
const DELETE_FOLLOWER_PS = "DELETE FROM user_follow WHERE user_name = ? AND following_user_name = ?";

// ALERTS SQL
const CREATE_ALERT_PS = `INSERT INTO alert 
                         (description, action_date, actor_user_name, affected_user_name, post_id, post_comment_id)
                         VALUES (?, ?, ?, ?, ?, ?)`;

const SELECT_ALERT_SQL = `SELECT a.alert_id, a.description, a.action_date,
                                 u1.user_name AS actor_user_name, u1.first_name AS actor_first_name, u1.middle_name AS actor_middle_name, u1.last_name AS actor_last_name,
                                 u2.user_name AS affected_user_name, u2.first_name AS affected_first_name, u2.middle_name AS affected_middle_name, u2.last_name AS affected_last_name,
                                 p.post_id, pc.post_comment_id 
                          FROM alert AS a 
                          INNER JOIN user AS u1
                                ON a.actor_user_name = u1.user_name 
                          INNER JOIN user AS u2
                                ON a.affected_user_name = u2.user_name 
                          LEFT OUTER JOIN post AS p
                                ON a.post_id = p.post_id 
                          LEFT OUTER JOIN post_comment AS pc
                                ON a.post_comment_id = pc.post_comment_id `;

const FIND_ALERTS_PS = SELECT_ALERT_SQL + 
                       `WHERE a.action_date > $actionDate and (a.actor_user_name = $userName or a.affected_user_name = $userName)
                        ORDER BY a.action_date DESC`;


// Main function
module.exports = function (doRunCreateTables = true) {
    if (doRunCreateTables && !this.init) {
        db.serialize(function () {
            loadSqlFile((data) => {
                db.exec(data, (err) => {
                    if (err) {
                        console.log(err);
                        throw err;
                    }
                });
            });
        });
        this.init = true;
    }

    this.isInit = function () {
        return this.init;
    }

    this.addAlert = function(alert, callback) {

        db.serialize(function() {

            var stmt = db.prepare(CREATE_ALERT_PS);
                        
            stmt.run(alert.description, new Date(), alert.actor.userName, alert.affectedUser.userName, alert.postId, alert.postCommentId, function(err) {

                if (err)
                {
                    callback("Unable to create alert: " + err, false);
                }
                else if (this.changes === 0)
                {
                    callback("Unable to create alert: 0 rows affected", false);
                }
                else
                {
                    callback(null, true);
                }
            });

            stmt.finalize();
        });
    };

    this.getSuggestions = function(userName, callback) {

        db.all(FIND_SUGGESTIONS_PS, { $userName: userName }, function(err, rows) {

            if (err)
            {
                callback("Unable to get suggestions: " + err, null);
            }
            else
            {
                var suggestions = [];

                if (rows)
                {
                    for (var row of rows)
                    {
                        suggestions.push({
                            user: {
                                userName: row.user_name,
                                firstName: row.first_name,
                                middleName: row.middle_name,
                                lastName: row.last_name
                            },
                            postIds: row.post_ids ? row.post_ids.split(',').sort((a, b) => {
                                if (a > b)
                                {
                                    return -1;
                                }
                                else if (a < b)
                                {
                                    return 1;
                                }
                                else
                                {
                                    return 0;
                                }
                            }).slice(0, 3) : []
                        });
                    }
                }
                
                callback(null, suggestions);
            }
        });
    };

    /*
     * return callback(err, row)
     */
    this.verifyUserAndPassword = function (userName, password, callback) {
        db.get(FIND_USER_BY_USERNAME_PWD_PS, userName, password, (err, row) => {
            if (err || row == undefined) {
                callback(row == undefined ? "No user found" : err, null);
            } else {
                callback(null, row);
            }
        });
    }

    /*
     * return callback(err, isSuccess)
     */
    this.insertUser = function (userName, password, firstName, middleName, lastName, callback) {
        var self = this;
        db.serialize(() => {
            var stmt = db.prepare(CREATE_USER_PS);
            stmt.run(userName, password, firstName, middleName, lastName, (err) => {
                if (err) {
                    callback(err, false);
                } else {
                    callback(null, true);

                    self.addAlert({
                        description: 'New User',
                        actor: { userName: userName },
                        affectedUser: { userName: userName },
                        postId: null,
                        postCommentId: null
                    }, (err) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            });
            stmt.finalize();
        });
    }

    /*
     * return callback(err, isSuccess)
     */
    this.insertPost = function (post, callback) {
        var self = this;
        var params = {
            $postDate: post.postDate,
            $description: post.description,
            $author: post.author,
            $image: post.data,
            $mimeType: post.mimeType,
            $encoding: post.encoding,
            $fileName: post.fileName,
            $fileSize: post.fileSize
        };

        db.serialize(() => {
            var stmt = db.prepare(CREATE_POST_PS);
            stmt.run(params, function (err) {
                if (err) {
                    callback(err, false);
                } else {
                    callback(null, true);

                    self.addAlert({
                        description: 'New Post',
                        actor: { userName: post.author },
                        affectedUser: { userName: post.author },
                        postId: this.lastID,
                        postCommentId: null
                    }, (err) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            });
            stmt.finalize();
        });
    };

    this.deletePost = function (postId, userName, callback) {
        db.run(DELETE_POST_PS, postId, userName, function (err, row) {
            if (err) {
                callback(err, false);
            } else if (this.changes === 0) {
                callback("Cannot find the row with post_id " + postId, false);
            } else {
                callback(null, true);
            }
        });
    }

    /**
     * Returns binary image data for the specified post
     * @param postId Unique identifier for the post
     * @returns binary data (image file) - null if no data 
     * associated with post
     */
    this.getPostImage = function (postId, callback) {

        db.get(READ_POST_IMAGE_PS, postId, (err, row) => {

            if (err || row === undefined) {
                callback("Unable to retrieve image for post " + postId + ": " + err, null);
            }
            else {
                callback(null, row);
            }
        });
    };

    /*
     * return callback(err, rows)
     */
    this.getPosts = function ( callback) {
        db.all(READ_POST_SQL, (err, rows) => {
            if (err || rows == undefined) {
                callback(err, null);
            } else {
                callback(null, rows);
            }
        });
    }

    /*
     * return callback(err, rows)
     */
    this.getPostsByUserName = function (userName, callback) {
        db.all(FIND_POST_BY_USER_PS, userName, (err, rows) => {
            if (err || rows == undefined) {
                callback(err, null);
            } else {
                callback(null, rows);
            }
        });
    }

    /*
     * return callback(err, row)
     */
    this.getPostById = function (id, callback) {
        db.get(FIND_POST_BY_ID_PS, id, (err, row) => {
            if (err) {
                callback(err, null);
            } else {
                if (row) {
                    callback(null, row);
                }
                else {
                    callback("Something weird happened in getPostById for id " + id, null);
                }
            }
        });
    }

    /*
     * return callback(err, row)
     */
    this.getPostCommentsByPostId = function (post_id, callback) {
        db.get(FIND_POST_COMMENTS_BY_POST_ID_PS, post_id, (err, rows) => {
            if (err || rows == undefined) {
                callback(err, null);
            } else {
                callback(null, rows);
            }
        });
    }

    /*
     * return callback(err, row)
     */
    this.getPostLikeCountByPostId = function (post_id, callback) {
        db.get(FIND_POST_LIKE_COUNT_BY_POST_ID_PS, post_id, (err, row) => {
            if (err || row == undefined) {
                callback(err, null);
            } else {
                callback(null, row);
            }
        });
    }

    /*
     * return callback(err, isSuccess)
     */
    this.insertUserFollow = function (userName, userToFollow, callback) {
        var self = this;

        db.run(CREATE_USER_FOLLOW_PS, userName, userToFollow, function (err) {
            if (err) {
                callback(err, false);
            } else {
                callback(null, true);

                self.addAlert({
                    description: 'Follow',
                    actor: { userName: userName },
                    affectedUser: { userName: userToFollow },
                    postId: null,
                    postCommentId: null
                }, (err) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        });
    }

    /*
     * return callback(err, isSuccess)
     */
    this.deleteUserFollow = function (userName, userToFollow, callback) {
        db.run(DELETE_FOLLOWER_PS, userName, userToFollow, function (err) {
            if (err) {
                callback(err, false);
            } else if (this.changes === 0) {
                callback("Cannot find the row with user_name " + userName, false);
            } else {
                callback(null, true);
            }
        });
    }

    /*
     * return callback(err, row)
     */
    this.getFollowerCountByUser = function (user_name, callback) {
        db.get(FIND_FOLLOWER_COUNT_BY_USER_PS, user_name, (err, row) => {
            if (err || row == undefined) {
                callback(err, null);
            } else {
                callback(null, row);
            }
        });
    }

    /*
     * return callback(err, row)
     */
    this.getFollowingCountByUser = function (user_name, callback) {
        db.get(FIND_FOLLOWOMG_COUNT_BY_USER_PS, user_name, (err, row) => {
            if (err || row == undefined) {
                callback(err, null);
            } else {
                callback(null, row);
            }
        });
    }

    /*
     * return callback(err, row)
     */
    this.getFollowerListByUser = function (user_name, callback) {
        db.all(FIND_FOLLOWER_LIST_BY_USER_PS, user_name, (err, rows) => {
            if (err || rows == undefined) {
                callback(err, null);
            } else {
                callback(null, rows);
            }
        });
    }

    /*
     * return callback(err, row)
     */
    this.getFollowingListByUser = function (user_name, callback) {
        db.all(FIND_FOLLOWING_LIST_BY_USER_PS, user_name, (err, rows) => {
            if (err || rows == undefined) {
                callback(err, null);
            } else {
                callback(null, rows);
            }
        });
    }

    /*
     * return callback(err, row)
     */
    this.getAlert = function (userName, callback) {
        var actionDate = new Date().getTime();
        actionDate -= (24 * 60 * 60 * 1000);
        actionDate = new Date(actionDate);

        var params = {
            $actionDate: actionDate,
            $userName: userName
        };

        db.all(FIND_ALERTS_PS, params, (err, rows) => {
            if (err || rows == undefined) {
                callback(err, null);
            } else {
                var alerts = [];
                for (var row of rows) {
                    alerts.push({
                        actionDate: new Date(row.action_date),
                        description: row.description,
                        actor: {
                            userName: row.actor_user_name,
                            firstName: row.actor_first_name,
                            middleName: row.actor_middle_name,
                            lastName: row.actor_last_name
                        },
                        affectedUser: {
                            userName: row.affected_user_name,
                            firstName: row.affected_first_name,
                            middleName: row.affected_middle_name,
                            lastName: row.affected_last_name
                        },
                        postId: row.post_id,
                        postCommnetId: row.post_comment_id
                    });
                }
                callback(null, alerts);
            }
        });
    }

    return this;
}

loadSqlFile = function (callback) {
    var fs = require("fs");
    fs.readFile(sqlCreateTableFileName, "utf-8", (err, data) => {
        if (err != null) {
            throw err;
        } else {
            callback(data);
        }
    });
}