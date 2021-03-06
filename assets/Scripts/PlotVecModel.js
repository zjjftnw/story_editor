/*
vector struct{
    uid;
    remark;
    packages:{
        uid:{
            uid;
            type;
            remark;
            dialogIds:[];
            triggerIds:[];
            arrowIds:[];
        },
        ...
    } 
    dialogs:{
        id: {
            id;
            role;
            music;
            sound;
            cg;
            bg;
            spd;
            shake;
            events:[]
            text;
        },
        ...
    }
    triggers:{
        id: {
            id;
            type;对应storyPot.xlsx中的类型
            param;根据不同的类型组合而成的string
        },
        ...
    }
    arrows:{
        id:{
            id;
            begin; 起始剧情包 、、//delete
            end; 结束剧情包
            compound: [
                id, operator, id operator, id
            ]
            conds:[
                {
                    id;
                    type;1.配置表中的条件数据

                    if type ==1
                        cond;(string)
                        remark;
                    elif type == 2
                        packageId;
                        categroy; 1.完成状态 2.完成次数 3.选项状态 4.选项次数
                        param;根据不同的 categroy 自己组合的参数
                },
                ...
            ]
        },
        ...
    }
}

*/



var PlotVecModel = (function () {

    var allPlotVec = null;
    var openedUid = null;
    var allUids = null;

    /**
     
    {
        uid:{
           vector struct
        }，
        ...
    }

     */

    var ret = {
        init: function (opened) {
            msg.register('PlotVecModel', msg.key.OPEN_A_PLOT_VEC, (tag, key, param) => { _open(param); }, this);
            msg.register('PlotVecModel', msg.key.SET_MARK_A_PLOT_VEC, (tag, key, param) => { _remark(param); }, this);
            msg.register('PlotVecModel', msg.key.REMOVE_A_PLOT_VEC, (tag, key, param) => { _delete(param); }, this);
            msg.register('PlotVecModel', msg.key.CREATE_A_PLOT_VEC, (tag, key, param) => { _create(param); }, this);
            msg.register('PlotVecModel', msg.key.SAVE, (tag, key, param) => { _save(param); }, this);

            allPlotVec = FileHelper.getJsonFromFile(opened);
            allUids = Object.keys(allPlotVec);
            if (allUids.length > 0) {
                openedUid = allUids[0];
            }

            if (openedUid) {
                _initSubModules();
                msg.send(msg.key.UI_INIT_ALL_MODULES, allPlotVec[openedUid]);
            } else {
                msg.send(msg.key.UI_UNINIT_ALL_MODULES);
            }
            msg.send(msg.key.UI_UPDATE_PLOT_VEC_INSPECTOR, _getBriefInfo());
            _logInfo();
        },

        uninit: function () {
            _uninitSubModules();

            allPlotVec = null;
            openedUid = null;
            allUids = null;
            msg.send(msg.key.UI_UPDATE_PLOT_VEC_INSPECTOR, null);
            msg.send(msg.key.UI_UNINIT_ALL_MODULES);
            msg.cancelAll('PlotVecModel')
            _logInfo();
        },

        getModel: function () {
            return allPlotVec;
        },

        //每个剧情文件中对应的包id都是唯一的，所以放在这里生成id
        genPackageUid: function () {
            if (this.maxUid) {
                ++this.maxUid;
            } else {
                let allUids = [];
                for (let vecId in allPlotVec) {
                    let packages = allPlotVec[vecId]['packages'];
                    if (packages) {
                        let tUids = Object.keys(packages);
                        allUids = allUids.concat(tUids);
                    }
                }
                if (allUids.length) {
                    allUids.sort();
                    this.maxUid = parseInt(allUids[allUids.length - 1]) + 1;
                } else {
                    this.maxUid = 1;
                }
            }
            return this.maxUid;
        },

        save: function () {
            _save();
        },
    };

    function _initSubModules() {
        if (openedUid) {
            PackageModel.init(allPlotVec[openedUid]['packages'], openedUid);
            DialogModel.init(allPlotVec[openedUid]['dialogs']);
            TriggerModel.init(allPlotVec[openedUid]['triggers']);
            ArrowModel.init(allPlotVec[openedUid]['arrows']);
            PlotVecCtrl.init();
            msg.send(msg.key.UI_INIT_OPERATION_MOULES);

        }
    }

    function _uninitSubModules() {
        if (openedUid) {
            PlotVecCtrl.uninit();
            PackageModel.uninit();
            DialogModel.uninit();
            TriggerModel.uninit();
            ArrowModel.uninit();
            msg.send(msg.key.UI_CLEAR_OPERATION_MOULES);
        }
    }

    function _mergeSubModules() {
        if (openedUid) {
            allPlotVec[openedUid]['packages'] = PackageModel.get();
            allPlotVec[openedUid]['dialogs'] = DialogModel.get();
            allPlotVec[openedUid]['triggers'] = TriggerModel.get();
            allPlotVec[openedUid]['arrows'] = ArrowModel.get();
        }
    }

    function _save() {
        if (allPlotVec) {
            let filename = FileMgr.getOpened();
            console.log('save filename: ' + filename);
            if (filename) {
                _mergeSubModules();
                FileHelper.writeJsonToFile(filename, allPlotVec);
            }
        }
    }

    function _create() {
        //get next uid
        let newuid = 1;
        if (allUids.length) {
            allUids.sort();
            let tMaxUid = allUids[allUids.length - 1];
            newuid = (typeof (tMaxUid) === 'string' ? parseInt(tMaxUid) : tMaxUid) + 1;
        }
        allPlotVec[newuid] = { uid: newuid, remark: '新的剧情图' };
        allUids = Object.keys(allPlotVec);
        msg.send(msg.key.UI_ADD_A_PLOT_VEC, { uid: newuid, remark: allPlotVec[newuid]['remark'] });
        if (!openedUid) {
            _open(newuid);
        }
        _logInfo();
    }

    function _delete(uid) {
        if (allPlotVec[uid]) {
            if (uid == openedUid) {
                _uninitSubModules();
                openedUid = null;
                delete allPlotVec[uid];
                allUids = Object.keys(allPlotVec);
                msg.send(msg.key.UI_UNINIT_ALL_MODULES);
                msg.send(msg.key.UI_DEL_A_PLOT_VEC, uid);
            } else {
                delete allPlotVec[uid];
                allUids = Object.keys(allPlotVec);
                msg.send(msg.key.UI_DEL_A_PLOT_VEC, uid);
            }
        }
        _logInfo();
    }

    function _open(uid) {
        if (uid == openedUid) {
            return;
        }
        if (!allPlotVec[uid]) {
            console.error(`uid: ${uid} do not exist`);
            return;
        }
        openedUid = uid;
        _uninitSubModules();
        _initSubModules();

        msg.send(msg.key.UI_OPEN_THE_PLOT_VEC, openedUid);
        msg.send(msg.key.UI_INIT_ALL_MODULES, allPlotVec[openedUid]);
        _logInfo();
    }

    function _remark(param) {
        let uid = param['uid'], remark = param['remark'];
        if (allPlotVec[uid]) {
            allPlotVec[uid]['remark'] = remark;
            msg.send(msg.key.UI_MARK_THE_PLOT_VEC, param);
        }
        _logInfo();
    }

    function _getBriefInfo() {
        let info = null;
        for (let uid in allPlotVec) {
            let plot = allPlotVec[uid];
            info = info || {};
            info[uid] = plot['remark'];
        }

        return {
            opened: openedUid,
            list: info,
        };
    }

    function _logInfo() {
        console.log("PlotVecInfo:----------------------------------------------------------")
        console.log("allPlotVec: " + JSON.stringify(allPlotVec));
        console.log("openedUid: " + JSON.stringify(openedUid));
        console.log("allUids: " + JSON.stringify(allUids));
        console.log("PlotVecInfo:----------------------------------------------------------")
    }

    return ret;
})();

/*
packages:{
        uid:{

            pos:node.position delete

            uid;
            type;//1.start 2.normal 3.option
            isOnce
            isGlobal : 0 //reference count ，如果该剧情包被其他的剧情文件所引用，则+1；被本文件所引用则不会递增
            remark;
            dialogIds:[];
            triggerIds:[];
            inArrowIds:[] delete
            arrowIds:[];
        },
        ...
    } 
*/
var PackageModel = (function () {
    var model = null;
    var ret = {
        init: function (param, baseuid) {
            model = param;
            console.log('model data===========================================');
            console.log(JSON.stringify(model));
            if (!model) {
                model = {};
                _createNew(1, "开始", cc.v2(0, 300));
            }
            console.log('model data===========================================');
            console.log(JSON.stringify(model));
            msg.register('PackageModel', msg.key.UPDATE_THE_PACKAGE_POS, (tag, key, param) => { _updatePos(param['uid'], param['pos']); }, this);
            msg.register('PackageModel', msg.key.UPDATE_THE_PACKAGE_REMARK, (tag, key, param) => { _updateRemark(param['uid'], param['remark']); }, this);
            msg.register('PackageModel', msg.key.CREATE_A_RECT, (tag, key, param) => {
                let newrect = _createNew(2, "新的剧情包", param);
                msg.send(msg.key.UI_CREATE_A_NEW_RECT, newrect);
            }, this);
        },

        uninit: function () {
            model = null;
            msg.cancelAll('PackageModel')
        },

        get: function () {
            return utils.deepCopy(model);
        },

        getBeginUid: function () {
            if (model) {
                for (let uid in model) {
                    if (model[uid]['type'] == 1) {
                        return uid;
                    }
                }
            }
            return null
        },

        getModel: function () {
            return model;
        },

        getSingle: function (uid) {
            if (model[uid]) {
                return model[uid];
            }
            return null;
        },

        addArrows: function (uid, arrowId) {
            if (model[uid]) {
                let index = utils.findIndex(model[uid]['arrowIds'], (v) => { return v == arrowId; });
                if (index == -1) {
                    model[uid]['arrowIds'].push(arrowId);
                }
            }
        },

        delArrow: function (uid, arrowId) {
            if (model[uid]) {
                let index = utils.findIndex(model[uid]['arrowIds'], (v) => { return v == arrowId; });
                if (index != -1) {
                    model[uid]['arrowIds'].splice(index, 1);
                }
            }
        },

        //添加入度箭头
        addInArrows: function (uid, arrowId) {
            if (model[uid]) {
                let index = utils.findIndex(model[uid]['inArrowIds'], (v) => { return v == arrowId; });
                if (index == -1) {
                    model[uid]['inArrowIds'].push(arrowId);
                }
            }
        },

        delInArrow: function (uid, arrowId) {
            if (model[uid]) {
                let index = utils.findIndex(model[uid]['inArrowIds'], (v) => { return v == arrowId; });
                if (index != -1) {
                    model[uid]['inArrowIds'].splice(index, 1);
                }
            }
        },

        //获取被其他条件引用的信息
        getRefInfo: function (uid) {
            if (model[uid]['isGlobal'] && Object.keys(model[uid]['isGlobal']).length) {
                return model[uid]['isGlobal'];
            } else {
                return null;
            }
        },
    };

    function _createNew(type, remark, v2) {
        let obj = {};
        obj['pos'] = { x: v2.x, y: v2.y };

        obj['uid'] = PlotVecModel.genPackageUid();
        obj['type'] = type;
        obj['remark'] = remark;
        obj['arrowIds'] = [];
        obj['inArrowIds'] = [];
        if (type == 1) {
            //create begin point
            model[obj['uid']] = obj;
            return obj;
        }
        obj['dialogIds'] = [];
        obj['triggerIds'] = [];
        if (type == 2) {
            //create normal package
            model[obj['uid']] = obj;
            return obj;
        }
        if (type == 3) {
            model[obj['uid']] = obj;
            return obj;
        }
        console.error('ERROR------------------------->> this type is undefined!!! type: ' + type);
    }

    function _updatePos(uid, pos) {
        if (model[uid]) {
            model[uid]['pos'] = pos;
        }
    }

    function _updateRemark(uid, remark) {
        if (model[uid]) {
            model[uid]['remark'] = remark;
        }
    }

    return ret;
})();

/**
 
 dialogs:{
        id: {
            id;
            role;
            music;
            sound;
            cg;
            bg;
            spd;
            shake;
            events:[]
            text;
        },
        ...
    }
 */
var DialogModel = (function () {
    var model = null;
    var ret = {
        init: function (param) {
            model = param || {};

        },

        uninit: function () {
            model = null;
        },

        get: function () {
            return utils.deepCopy(model);
        },

        getModel: function () {
            return model;
        },

        createNew: function () {
            let obj = {
                id: _genId(),
                role: null,
                music: config.DEFAULT_BGM,
                sound: null,
                cg: null,
                bg: null,
                spd: config.DEFAULT_SPEED,
                shake: 0,
                events: [],
                text: '',
            };
            model[obj['id']] = obj;
            return obj;
        },
    };

    function _genId() {
        let allIds = Object.keys(model);
        allIds.sort();
        if (!allIds.length) {
            return 1;
        }
        let currmax = allIds[allIds.length - 1];
        return parseInt(currmax) + 1;
    }

    return ret;
})();

var TriggerModel = (function () {
    var model = null;
    var ret = {
        init: function (param) {
            model = param || {};
        },

        uninit: function () {
            model = null;
        },

        get: function () {
            return utils.deepCopy(model);
        },

        getModel: function () {
            return model;
        },
    };

    function _genId() {
        let allIds = Object.keys(model);
        allIds.sort();
        if (!allIds.length) {
            return 1;
        }
        let currmax = allIds[allIds.length - 1];
        return parseInt(currmax) + 1;
    }

    return ret;
})();

/*
arrows:{
        id:{
            id;
            begin; 起始剧情包 、、//delete
            end; 结束剧情包

            //只有选项式才会存在以下内容
            text: 选项式剧情的文本
            isOption:是否为选项式
            activecond：类似 cond
            displaycond:类似 cond

            //只有一般的arrow才会存在该属性
            cond: [
                id,operator,id,operator,id
            ]

            triggers:[{
                {
                    id
                    type:
                    param:
                }
            }]

            subConds:[
                {
                    id;
                    type;1.配置表中的条件数据

                    if type ==1
                        cond;(string)
                        remark;
                    elif type == 2
                        file:
                        packageId;
                        categroy; 1.完成状态 2.完成次数 3.选项状态 4.选项次数
                        param;根据不同的 categroy 自己组合的参数
                },
                ...
            ]
        },
        ...
    }
*/


var ArrowModel = (function () {
    var model = null;
    var ret = {
        init: function (param) {
            model = param || {};
        },

        uninit: function () {
            model = null;
        },

        get: function () {
            return utils.deepCopy(model);
        },

        createNew: function (begin, end) {
            return _createSimple(begin, end)['id'];
        },

        getModel: function () { return model; },

        getSingle: function (arrowId) {
            if (model[arrowId]) {
                return model[arrowId];
            }
            return null;
        },

        delSingal: function (arrowId) {
            if (model[arrowId]) {
                var arrow = model[arrowId];
                if (arrow['subConds']) {
                    arrow['subConds'].forEach(tSubCond => {
                        if (tSubCond['type'] == 2 && tSubCond['file'] && tSubCond['packageId']) {
                            FileCache.decreaseReferenceCount(tSubCond['file'], tSubCond['packageId'], FileMgr.getOpened(), arrowId);
                        }
                    });
                }
                delete model[arrowId];
                msg.send(msg.key.SAVE);
            }
        },

        genTrigger: function (arrowId) {
            var arrow = model[arrowId];
            var ret = null;
            if (arrow['triggers'] && arrow['triggers'].length) {
                let maxId = 1;
                arrow['triggers'].forEach(v => {
                    if (v['id'] > maxId) {
                        maxId = v['id'];
                    }
                })
                ret = {
                    id: ++maxId,
                    type: 1
                };
                arrow['triggers'].push(ret);
            } else {
                ret = {
                    id: 1,
                    type: 1
                };
                arrow['triggers'] = [ret];
            }
            return ret;
        },

        getTrigger: function (arrowId, triggerId) {
            if (model[arrowId]) {
                let triggers = model[arrowId]['triggers'];
                if (model[arrowId]['triggers']) {
                    for (let i = 0; i < triggers.length; ++i) {
                        if (triggers[i]['id'] == triggerId) {
                            return triggers[i];
                        }
                    }
                }
            }
            return null;
        },

        delTrigger: function (arrowId, triggerId) {
            var arrow = model[arrowId];
            if (arrow && arrow['triggers']) {
                for (let i = 0; i < arrow['triggers'].length; ++i) {
                    if (arrow['triggers'][i]['id'] == triggerId) {
                        arrow['triggers'].splice(i, 1);
                        break;
                    }
                }
            }
        },

        genSubCond: function (arrowId, type = 1) {
            var arrow = model[arrowId];
            var ret = null;
            if (arrow['subConds'] && arrow['subConds'].length) {
                let maxId = 1;
                arrow['subConds'].forEach(v => {
                    if (v['id'] > maxId) {
                        maxId = v['id'];
                    }
                })
                ret = {
                    id: ++maxId,
                    type: type
                };
                arrow['subConds'].push(ret);
            } else {
                ret = {
                    id: 1,
                    type: type
                };
                arrow['subConds'] = [ret];
            }
            return ret;
        },

        getSubCond: function (arrowId, condId) {
            if (model[arrowId]) {
                let subConds = model[arrowId]['subConds'];
                if (model[arrowId]['subConds']) {
                    for (let i = 0; i < subConds.length; ++i) {
                        if (subConds[i]['id'] == condId) {
                            return subConds[i];
                        }
                    }
                }
            }
            return null;
        },

        delSubCond: function (arrowId, condId) {
            var arrow = model[arrowId];
            if (arrow && arrow['subConds']) {
                let tIndex = arrow['subConds'].findIndex(v => v['id'] == condId);
                if (tIndex == -1) { return; }
                let tSubCond = arrow['subConds'][tIndex];
                arrow['subConds'].splice(tIndex, 1);

                if (tSubCond['type'] == 2 && tSubCond['file'] && tSubCond['packageId']) {
                    FileCache.decreaseReferenceCount(tSubCond['file'], tSubCond['packageId'], FileMgr.getOpened(), arrowId);
                    msg.send(msg.key.SAVE);
                }
            }
        },
    };

    function _createSimple(begin, end) {
        var arrow = {};
        arrow['id'] = _genId();
        arrow['begin'] = parseInt(begin);
        if (end) {
            arrow['end'] = parseInt(end);
        }

        if (PackageModel.getSingle(begin)['type'] == 3) {
            arrow['isOption'] = 1;
        }

        model[arrow['id']] = arrow;
        return arrow;
    }

    function _genId() {
        let allIds = Object.keys(model);
        allIds.sort();
        if (!allIds.length) {
            return 1;
        }
        let currmax = allIds[allIds.length - 1];
        return parseInt(currmax) + 1;
    }

    return ret;
})();

var DataCache = (function () {
    var data = {};

    var ret = {
        getfiles: function () {
            return FileMgr.getAllFiles();
        },

        getdata: function (filename) {
            if (filename == FileMgr.getOpened()) {
                return PlotVecModel.getModel();
            }
            if (!data[filename]) {
                data[filename] = FileHelper.getJsonFromFile(filename);
            }
            return data[filename];
        },

        savedata: function (filename) {
            if (filename == FileMgr.getOpened()) {
                PlotVecModel.save();
            } else {
                if (data[filename]) {
                    FileHelper.writeJsonToFile(filename, data[filename]);
                }
            }
        },

        getPackagesBrief: function (filename) {
            let json = this.getdata(filename);
            let allUids = {};
            for (let vecId in json) {
                let packages = json[vecId]['packages'];
                if (packages) {
                    for (let uid in packages) {
                        allUids[uid] = packages[uid]['remark'];
                    }
                }
            }
            return allUids;
        },

        getPackage: function (filename, packageUid) {
            let filedata = this.getdata(filename);
            for (let vecId in filedata) {
                let packages = filedata[vecId]['packages'];
                if (packages[packageUid]) {
                    return packages[packageUid];
                }
            }
            console.error(`cannot get package data. file: ${filename}, uid: ${packageUid}`);
        },

        getVector: function (filename, packageUid) {
            let filedata = this.getdata(filename);
            for (let vecId in filedata) {
                let packages = filedata[vecId]['packages'];
                if (packages[packageUid]) {
                    return filedata[vecId];
                }
            }
            console.error(`cannot get package data. file: ${filename}, uid: ${packageUid}`);
        },

        decreaseReferenceCount: function (tagFile, packageUid, refFile, refArrowId) {
            // if (tagFile == refFile) {
            //     return;
            // }
            let pack = this.getPackage(tagFile, packageUid);
            let data = pack['isGlobal'] || {};
            if (data[refFile] && data[refFile].length) {
                let index = data[refFile].findIndex(v => v == refArrowId);
                if (index != -1) {
                    data[refFile].splice(index, 1);
                    if (data[refFile].length == 0) {
                        delete data[refFile];
                    }
                    pack['isGlobal'] = data;
                    this.savedata(tagFile);
                }
            }
        },

        incrreaseReferenceCount: function (tagFile, packageUid, refFile, refArrowId) {
            // if (tagFile == refFile) {
            //     return;
            // }
            let pack = this.getPackage(tagFile, packageUid);
            let data = pack['isGlobal'] || {};
            data[refFile] = data[refFile] || [];
            data[refFile].push(refArrowId);
            pack['isGlobal'] = data;
            this.savedata(tagFile);
        },
    }
    return ret;
})()

window.FileCache = DataCache;

window.PlotVecModel = PlotVecModel;
window.PackageModel = PackageModel;
window.ArrowModel = ArrowModel;
window.DialogModel = DialogModel;
window.TriggerModel = TriggerModel;