// Description:
//   Finds any TODO's in the form of [ ] markdown on a github issue (and in its comments, and on its line/commit comments in case of a PR)
//
// Dependencies:
//   async ^0.7.0
//   githubot 0.4.x
//
// Configuration:
//   HUBOT_GITHUB_REPO
//   HUBOT_GITHUB_TOKEN
//   HUBOT_GITHUB_API
//
// Commands:
//   Hubot todo nnn
//   Hubot todo #nnn
//
// Author:
//   caske33

var async = require('async');

var completedChar = "✓";// ✓ ✔ :heavy_check_mark:
var uncompletedChar = "✗";//:heavy_multiplication_x: ✖ ✘ ✗ ✕

var parseToDos = function(body, url){
  var result = [];
  var reg = /\[([ x])\] ?([^\r\n]*)/gi;
  var match;
  while(match = reg.exec(body)){
    var prefix = (match[1] == " ") ? uncompletedChar : completedChar;
    result.push(prefix + " " + match[2] + " in " + url + "\r\n");
  }
  return result;
}

//var mapApiCall = function(apiResult){
//  return {
//    todo: parseToDos(apiResult.body),
//    url: apiResult.html_url
//  }
//}

module.exports = function(robot){
  var github = require("githubot")(robot);

  robot.respond(/todo \#?(\d+)/i,function(msg){
    var issue_number = msg.match[1];
    var base_url = process.env.HUBOT_GITHUB_API || 'https://api.github.com';
    var bot_github_repo = process.env.HUBOT_GITHUB_REPO;

    var repo_url = base_url+"/repos/"+bot_github_repo;
    var issue_url = repo_url+"/issues/"+issue_number;
    var pull_url = repo_url+"/pulls/"+issue_number;

    var response = "";

    github.get(issue_url, function(issue){
      var todos = parseToDos(issue.body, issue.html_url);
      //if(todos.length == 0)
      //  response += "No TODO's found in the issue's body";
      //else
      response += todos.join("");

      //if(issue.comments > 0){
      //  github.get(issue_url+"/comments", function(comments){
      //    var bodies = comments.map(function(comment){return parseToDos(comment.body, comment.html_url)});
      //    for (var i=0; i < bodies.length; i++) {
      //      response += bodies.join("\r\n");
      //    }
      //  });
      //}
      async.parallel([
        function(cb){
          if(issue.comments > 0){
            github.get(issue_url+"/comments", function(comments){
              var bodies = comments.map(function(comment){return parseToDos(comment.body, comment.html_url)});
              cb(null, bodies);
            });
          }
          else
            cb(null, []);
        },
        function(cb){
          if(issue.hasOwnProperty("pull_request") && issue.pull_request.url){
            github.get(pull_url+"/comments", function(comments){
              var bodies = comments.map(function(comment){return parseToDos(comment.body, comment.html_url)});
              cb(null, bodies);
            });
          }
          else
            cb(null, []);
        },
        function(cb){
          if(issue.hasOwnProperty("pull_request") && issue.pull_request.url){
            github.get(pull_url+"/commits", function(commits){
              var commit_comments = [];
              async.each(commits, function(commit, cb2){
                if(commit.commit.comment_count > 0){
                  github.get(repo_url+"/commits/"+commit.sha+"/comments", function(comments){
                    var bodies = comments.map(function(comment){return parseToDos(comment.body, comment.html_url)});
                    if(bodies.length > 0)
                      commit_comments.push(bodies);
                    cb2();
                  });
                }else
                  cb2();
              }, function(err){
                cb(null, commit_comments);
              })
            });
          }
          else
            cb(null, []);
        }
      ],function(err, res){
          for (var i=0; i < res.length; i++) {
            for (var k=0; k < res[i].length; k++) {
              response += res[i][k].join("");
            }
          }
          if(response.length > 0)
            msg.send(response.substr(0,response.length-2));
          else
            msg.send("Couldn't find any TODO's");
      })
    });
  });
}
