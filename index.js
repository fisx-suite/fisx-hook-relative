/**
 * @file fis 支持相对路径处理模块，基于 https://github.com/fex-team/fis3-hook-relative
 *       修改，兼容使用 `domain` 情况下，对于指定 relative 的文件还能继续使用 relative 路径
 * @author fis
 *         sparklewhy@gmail.com
 */

var rUrl = /__relative\(([\s\S]*?)\)/g;
var path = require('path');
var rFile = /\.[^\.]+$/;

function wrap(value) {
    return '__relative(' + value + ')';
}

function getRelativeUrl(file, host) {
    var url;

    if (typeof file === 'string') {
        url = file;
    }
    else {
        if (host.isJsLike) {
            url = file.url;
        }
        else {
            url = file.getUrl();

            if (file.domain) {
                url = url.replace(file.domain, '');
            }
        }
    }

    var relativeFrom = typeof host.relative === 'string' ? host.relative : host.release;
    if (rFile.test(relativeFrom)) {
        relativeFrom = path.dirname(relativeFrom);
    }

    url = path.relative(relativeFrom, url);

    var result = url.replace(/\\/g, '/') + (file.query || '');
    if (host.isJsLike) {
        return './' + result;
    }
    return result;
}

function convert(content, file, host) {
    return content.replace(rUrl, function (all, value) {
        var info = fis.project.lookup(value);

        if (!info.file) {
            return info.origin;
        }

        // 再编译一遍，为了保证 hash 值是一样的。
        fis.compile(info.file);

        var query = (info.file.query && info.query) ? '&' + info.query.substring(1) : info.query;
        var hash = info.hash || info.file.hash;
        var url = getRelativeUrl(info.file, host || file);
        return info.quote + url + query + hash + info.quote;
    });
}

function onStandardRestoreUri(message) {
    var file = message.file;
    var info = message.info;

    // 没有配置，不开启。
    // 或者目标文件不存在
    if (!file.relative || !info.file) {
        return;
    }

    var query = (info.file.query && info.query) ? '&' + info.query.substring(1) : info.query;
    message.ret = wrap(info.quote + info.file.subpath + query + info.quote);
}

function onProcessEnd(file) {
    // 没有配置，不开启。
    if (!file.relative || !file.isText()) {
        return;
    }

    var content = file.getContent();
    file.relativeBody = content;
    content = convert(content, file);
    file.setContent(content);
}

function onPackFile(message) {
    var file = message.file;
    var content = message.content;
    var pkg = message.pkg;

    // 没有配置，不开启。
    if (!file.relative || !file.relativeBody) {
        return;
    }

    content = convert(file.relativeBody, file, pkg);
    message.content = content;
}

function onFetchRelativeUrl(message) {
    var target = message.target;
    var host = message.file;

    if (!host.relative) {
        return;
    }

    message.ret = getRelativeUrl(target, host);
}

module.exports = function (fis, opts) {

    fis.on('proccess:end', onProcessEnd);
    fis.on('standard:restore:uri', onStandardRestoreUri);
    fis.on('pack:file', onPackFile);

    // 给其他插件用的
    fis.on('plugin:relative:fetch', onFetchRelativeUrl);
};
