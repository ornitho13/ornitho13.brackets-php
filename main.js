/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, brackets, $, window */

define(function (require, exports, module) {
    'use strict';
    
    
    var AppInit             = brackets.getModule("utils/AppInit"),
        CodeHintManager     = brackets.getModule("editor/CodeHintManager"),
        LanguageManager     = brackets.getModule("language/LanguageManager"),
        TokenUtils          = brackets.getModule("utils/TokenUtils"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        FileSystem          = brackets.getModule("filesystem/FileSystem"),
        FileUtils           = brackets.getModule("file/FileUtils");

    var predefinedFunctions = require("syntax/php-predefined"),
        functionsModule     = require("text!syntax/php-function-groups.json");

    function AutoComplete() {
        //get functions list
        this.editor = null;
        this.phpFunctions = this.getFunctionList();
        //this.phpClass = this.getClassList();
        this.templates = this.getTemplates();
        this.phpVarFromDocument = [];
        this.phpVarRegExp = /[$][\a-zA-Z_][a-zA-Z0-9_]*/g;
        this.phpClassFunctionRegExp = /(private|public|protected|final|static)*\s*(function)\s+([a-zA-Z0-9_]*)/g;
        this.phpClassVarRegExp = /(private|public|const|protected|static)\s+([$][\a-zA-Z_][a-zA-Z0-9_]*)/g;
        this.isPhpFileRegExp = /.*\.(php|phtml)$/g;
        this.isPhpClassRegExp = /class\s+([a-zA-Z0-9_]*)\{*/g;
        this.isClass = false;
        
        this.methodFromClass = [];
        
        this.lastToken = '';
        this.activeToken = '';
    }
    
    function getTokenToCursor(token) {
        var tokenStart = token.token.start,
            tokenCursor = token.pos.ch,
            tokenString = token.token.string;
        return tokenString.substr(0, (tokenCursor - tokenStart));
    }
    
    /*
     * get class function
     */
    AutoComplete.prototype.getMethodsFromClass = function() {
        var regExp = new RegExp(this.phpClassFunctionRegExp),
            methodList = regExp.exec(this.editor.document.getText());
        
        console.log(methodList);
        if (methodList !== false) {

            var i = 0, len = methodList.length;
            for (; i < len; i++) {
                var hint = methodList[i][3];
                console.log(hint);
                if (this.methodFromClass.indexOf(hint) === -1) {
                    this.methodFromClass.push(hint);
                }
            }
        }
    }
    /**
     * get var list from the current Document
     */
    AutoComplete.prototype.getVarList = function () {
        var varList = this.editor.document.getText().match(this.phpVarRegExp);
        if (varList) {
            var i = 0, len = varList.length;
            for (; i < len; i++) {
                var hint = varList[i];
                //if not in phpVarFromDocument then push it
                if (this.phpVarFromDocument.indexOf(hint) === -1) {
                    this.phpVarFromDocument.push(hint);
                }
            }
        }
    };
    
    /*AutoComplete.prototype.getClassList = function () {

        var rootProjectPath = ProjectManager.getProjectRoot(), _self = this;
        //console.log(FileSystem.getDirectoryForPath(rootProjectPath));
        console.log(rootProjectPath._contents);
        for (var i = 0; i < rootProjectPath._contents.length; i++) {
            var item = rootProjectPath._contents[i];
            if (item.isDirectory) {
                //console.log(item);
            } else {
                //is File
                if (item._name.match(this.isPhpFileRegExp)) {
                    var file = FileSystem.getFileForPath(item._path);
                    var promise = FileUtils.readAsText(file);
                    promise.done(function (text) {
                        _self.checkPhpData(text);
                    }).fail(function (errorCode) {
                        console.log("Error: " + errorCode);
                    });
                }
            }
        }
        
    }*/
    /*
     * check if this text got php public data (like class, method, namespace, ...)
     */
    AutoComplete.prototype.checkPhpData = function (text) {
        var functionList = text.match(this.phpClassFunctionRegExp);
        var varList = text.match(this.phpClassVarRegExp);
        var phpClass = text.match(this.isPhpClassRegExp);
        var phpClassList = [];
        console.log(text, phpClass);
        //is php class File
        if (phpClass) {
            if (varList) {
                
            }
        }
    }
    
    /**
     * get templating
     */
    AutoComplete.prototype.getTemplates = function () {
        var templates = require('text!template/template.json');
        templates = JSON.parse(templates);
        return templates;
    };
    
    /**
     * get predefined list of php function, variables, constant, keywords and module
     */
    AutoComplete.prototype.getFunctionList = function () {
        functionsModule = JSON.parse(functionsModule);
        predefinedFunctions.module = functionsModule;
        var phpFunctions        = {
            predefinedConstants : [],
            predefinedVariables : [],
            predefinedFunctions : [],
            keywords : [],
            module : []
        }, prop;
        
        for (prop in predefinedFunctions) {
            var i = 0, keywords = predefinedFunctions[prop], len = keywords.length, property;
            if (prop === 'module') {
                for (property in keywords) {
                    i = 0;
                    var module = keywords[property].fnNames, lenModule = module.length;
                    for (; i < lenModule; i++) {
                        var moduleArray = module[i].split('|'), j = 0;
                        //console.log(moduleArray);
                        for (; j < moduleArray.length; j++) {
                            if (moduleArray[j] !== '') {
                                phpFunctions[prop].push(moduleArray[j]);
                            }
                        }
                    }
                    
                }
            } else {
                
                for (; i < len; i++) {
                    phpFunctions[prop].push(keywords[i]);
                }
            }
        }
        return phpFunctions;
    };
    
    AutoComplete.prototype.hasHints = function (editor, implicitChar) {
        this.editor = editor;
        var cursor = this.editor.getCursorPos(),
            tokenToCursor = "";
        this.activeToken = TokenUtils.getInitialContext(this.editor._codeMirror, cursor);
        
        // if implicitChar or 1 letter token is $, we *always* have hints so return immediately
        if (implicitChar === "$"  || this.activeToken.token.string.charAt(0) === "$") {
            return true;
        }
        
        tokenToCursor = getTokenToCursor(this.activeToken);
        
        // has hint 
        if (this.activeToken.token.string.length > 1 || implicitChar === null) {
            //search in phpFunction if hint exists
            for (var prop in this.phpFunctions) {
                var i = 0, items = this.phpFunctions[prop], len = items.length;
                for (; i < len; i++) {
                    if (items[i].indexOf(tokenToCursor) > -1) {
                        return true;
                    }
                }
            }
        }
        
        // no hint founds
        return false;
    };

    AutoComplete.prototype.getHints = function (implicitChar) {
        //get the active token and string attached
        var cursor = this.editor.getCursorPos(),
            tokenToCursor = '',
            hintList = [], 
            i = 0, 
            localVars = [], 
            phpVars = [];
        
        this.activeToken = TokenUtils.getInitialContext(this.editor._codeMirror, cursor);
        //console.log(this.activeToken);
        tokenToCursor = getTokenToCursor(this.activeToken);
        console.log(tokenToCursor, implicitChar);
        
        //get $variable from document
        if (implicitChar === '$' || (this.activeToken.token.string.charAt(0) === '$' && this.activeToken.token.string !== '$this')) {
            console.log('search variable');
            //search variables in document
            if ((this.lastToken === "") || (this.activeToken.token.start !== this.lastToken.token.start) || (this.activeToken.pos.line !== this.lastToken.pos.line)) {
                this.phpVarFromDocument.length = 0;
                this.getVarList();
                //this.getMethodFromClass();
            }
            
            this.lastToken = this.activeToken;
            if (this.phpVarFromDocument === null) {
                return null;
            }
            
            this.phpVarFromDocument.sort();
            // put the local variable first
            var len = this.phpVarFromDocument.length;
            for (; i < len; i++) {
                var item = this.phpVarFromDocument[i];
                if (item.indexOf(tokenToCursor) > -1) {
                    localVars.push('<span class="local-var"></span>' + item);
                }
            }
            
            localVars.sort();
            
            // put the php var next
            i = 0, len = this.phpFunctions.predefinedVariables.length;
            for (; i < len; i++) {
                var item = this.phpFunctions.predefinedVariables[i];
                if (item.indexOf(tokenToCursor) > -1) {
                    phpVars.push('<span class="php-var"></span>' + item);
                }
            }
            
            phpVars.sort();
            
            hintList = localVars.concat(phpVars);
        } else if (this.activeToken.token.string === '$this') {
            console.log('search variable in class');
            //if ((this.lastToken === "") || (this.activeToken.token.start !== this.lastToken.token.start) || (this.activeToken.pos.line !== this.lastToken.pos.line)) 
            {
                this.phpVarFromDocument.length = 0;
                this.getVarList();
                this.getMethodsFromClass();
                this.phpVarFromDocument.sort();
                // put the local variable first
                var len = this.phpVarFromDocument.length;
                for (; i < len; i++) {
                    var item = this.phpVarFromDocument[i];
                    if (item.indexOf(tokenToCursor) > -1) {
                        localVars.push('<span class="local-var"></span>' + item);
                    }
                }

                localVars.sort();
                
                // put the php method class next
                i = 0, len = this.methodFromClass.predefinedVariables.length;
                for (; i < len; i++) {
                    var item = this.methodFromClass.predefinedVariables[i];
                    if (item.indexOf(tokenToCursor) > -1) {
                        phpVars.push('<span class="php-var"></span>' + item);
                    }
                }
                hintList = localVars.concat(phpVars);
            }
        } else {
            console.log('search php keyword, function or module');
                // not a $ hint then search in php keywords constant, function and module
                //var len = this.phpFunctions.
                for (var prop in this.phpFunctions) {
                    var items = this.phpFunctions[prop], len = items.length;
                    i = 0;
                    for (; i < len; i++) {
                        var item = items[i];
                        if (item.indexOf(tokenToCursor) > -1) {
                            if (prop === 'predefinedFunctions' || prop === 'module') {
                                item = item + '()';
                            }
                            hintList.push('<span class="' + prop + '"></span>' + item);
                        }
                    }
                }
            hintList.sort();
        }
        
        return {
            hints: hintList,
            match: false,
            selectInitial: true,
            handleWideResults: false
        };
    };
    
    AutoComplete.prototype.hasTemplate = function (hint) {
        var prop;
        for (prop in this.templates) {
            if (prop === hint) {
                hint = this.templates[prop];
            }
        }
        return hint;
    };

    AutoComplete.prototype.insertHint = function (hint) {
        var cursor              = this.editor.getCursorPos(),
            currentToken        = this.editor._codeMirror.getTokenAt(cursor),
            replaceStart        = {line: cursor.line, ch: currentToken.start},
            replaceEnd          = {line: cursor.line, ch: cursor.ch};

        hint = hint.replace(/<span.*\><\/span\>/, '');
        hint = this.hasTemplate(hint);
        this.editor.document.replaceRange(hint, replaceStart, replaceEnd);
        return false;
    };

    AppInit.appReady(function () {
        var autoComplete = new AutoComplete();
        CodeHintManager.registerHintProvider(autoComplete, ['php'], 11);
        ExtensionUtils.loadStyleSheet(module, 'styles/styles.css');
    });
    
});