/**
 * @file  This file used to draw tree view
 */

define(function (require) {

    var graphic = require('../../util/graphic');
    var zrUtil = require('zrender/core/util');
    // var helper = require('./traversalHelper');
    // var eachBefore = helper.eachBefore;
    var Symbol = require('../helper/Symbol');
    var layoutHelper = require('./layoutHelper');
    var radialCoordinate = layoutHelper.radialCoordinate;


    return require('../../echarts').extendChartView({

        type: 'tree',

        /**
         * Init the chart
         * @override
         * @param  {module:echarts/model/Global} ecModel
         * @param  {module:echarts/ExtensionAPI} api
         */
        init: function (ecModel, api) {

            /**
             * @private
             * @type {module:echarts/data/Tree}
             */
            this._oldTree;

            /**
             * @private
             * @type {module:zrender/container/Group}
             */
            this._mainGroup = new graphic.Group();

            this.group.add(this._mainGroup);
        },

        render: function (seriesModel, ecModel, api, payload) {

            var data = seriesModel.getData();

            var layoutInfo = seriesModel.layoutInfo;

            var group = this._mainGroup;

            // group.removeAll();

            group.position = [layoutInfo.x, layoutInfo.y];

            var oldData = this._data;

            var seriesScope = {
                layout: seriesModel.get('layout'),
                orient: seriesModel.get('orient'),
                curvature: seriesModel.get('lineStyle.normal.curveness'),
                // itemStyle: seriesModel.getModel('itemStyle.normal').getItemStyle(),
                // hoverItemStyle: seriesModel.getModel('itemStyle.emphasis').getItemStyle(),
                symbolRotate: seriesModel.get('symbolRotate'),
                symbolOffset: seriesModel.get('symbolOffset'),
                hoverAnimation: seriesModel.get('hoverAnimation'),
                // lineStyle: seriesModel.getModel('lineStyle.normal').getLineStyle(),
                // labelModel: seriesModel.getModel('label.normal'),
                // hoverLabelModel: seriesModel.getModel('label.emphasis'),
                useNameLabel: true
            };

            data.diff(oldData)
                .add(function (newIdx) {
                    if (symbolNeedsDraw(data, newIdx)) {
                        // create node and edge
                        updateNode(data, newIdx, null, group, seriesModel, seriesScope);
                    }
                })
                .update(function (newIdx, oldIdx) {
                    var symbolEl = oldData.getItemGraphicEl(oldIdx);
                    if (!symbolNeedsDraw(data, newIdx)) {
                        symbolEl && removeNode(data, newIdx, symbolEl, group, seriesModel, seriesScope);
                        return;
                    }
                    // update  node and edge
                    updateNode(data, newIdx, symbolEl, group, seriesModel, seriesScope);
                })
                .remove(function (oldIdx) {
                    var symbolEl = oldData.getItemGraphicEl(oldIdx);
                    removeNode(data, oldIdx, symbolEl, group, seriesModel, seriesScope);
                })
                .execute();

            // TODO
            // view.remove ...

            data.eachItemGraphicEl(function (el, dataIndex) {
                el.off('click').on('click', function () {
                    api.dispatchAction({
                        type: 'treeExpandAndCollapse',
                        seriesId: seriesModel.id,
                        dataIndex: dataIndex
                    });
                });
            });

            this._data = data;

        },

        /**
         * Render the chart
         * @override
         * @param  {module:echarts/model/Series} seriesModel
         * @param  {module:echarts/model/Global} ecModel
         * @param  {module:echarts/ExtensionAPI} api
         * @param  {Object} payload
         */
        // render1: function (seriesModel, ecModel, api, payload) {

        //     eachBefore(realRoot, function (node) {
        //         if (node !== realRoot) {
        //             edges.push({source: node.parentNode, target: node});
        //         }
        //     });

        //     var radius = seriesModel.get('nodeRadius');

        //     eachBefore(realRoot, function (node) {
        //         var layout = node.getLayout();
        //         // leaf node will get the leavesModel
        //         var itemModel = node.getModel();
        //         var itemNormalStyle = itemModel.getModel('itemStyle.normal').getItemStyle();
        //         var labelModel = itemModel.getModel('label.normal');
        //         var textStyleModel = labelModel.getModel('textStyle');
        //         // var expandAndCollapse = seriesModel.get('expandAndCollapse');

        //         nodeData.setItemGraphicEl(node.dataIndex, circle);

        //     });
        // },

        dispose: function () {}

    });

    function symbolNeedsDraw(data, dataIndex) {
        var layout = data.getItemLayout(dataIndex);

        return layout
            && !isNaN(layout.x) && !isNaN(layout.y)
            && data.getItemVisual(dataIndex, 'symbol') !== 'none';
    }

    function getTreeNodeStyle(node, itemModel, seriesScope) {

        // seriesScope.curvature = itemModel.get('lineStyle.normal.curveness');
        seriesScope.itemModel = itemModel;
        seriesScope.itemStyle = itemModel.getModel('itemStyle.normal').getItemStyle();
        seriesScope.hoverItemStyle = itemModel.getModel('itemStyle.emphasis').getItemStyle();
        seriesScope.lineStyle = itemModel.getModel('lineStyle.normal').getLineStyle();
        seriesScope.labelModel = itemModel.getModel('label.normal');
        seriesScope.hoverLabelModel = itemModel.getModel('label.emphasis');



        if (node.isExpand === false && node.children.length !== 0) {
            seriesScope.symbolInnerColor = seriesScope.itemStyle.fill;
            // symbolEl.getSymbolPath().setStyle('fill', seriesScope.itemStyle.fill);
        }
        else {
            seriesScope.symbolInnerColor = '#fff';
        }



        return seriesScope;
    }


    function updateNode(data, dataIndex, symbolEl, group, seriesModel, seriesScope) {
        var node = data.tree.getNodeByDataIndex(dataIndex);
        var itemModel = node.getModel();
        var seriesScope = getTreeNodeStyle(node, itemModel, seriesScope);

        var virtualRoot = data.tree.root;
        var source = node.parentNode === virtualRoot ? node : node.parentNode || node;

        // FIXME
        // parentNode layout illegal?
        var sourceSymbolEl = data.getItemGraphicEl(source.dataIndex);
        var sourceLayout = source.getLayout();
        var sourceOldLayout = sourceSymbolEl
            ? {x: sourceSymbolEl.position[0], y: sourceSymbolEl.position[1]}
            : sourceLayout;
        var targetLayout = node.getLayout();

        if (!symbolEl) {
            symbolEl = new Symbol(data, dataIndex, {useNameLabel: true});
            symbolEl.attr('position', [sourceOldLayout.x, sourceOldLayout.y]);
        }

        symbolEl.updateData(data, dataIndex, seriesScope);
        graphic.updateProps(symbolEl, {
            position: [targetLayout.x, targetLayout.y]
        }, seriesModel);


        group.add(symbolEl);
        data.setItemGraphicEl(dataIndex, symbolEl);

        if (node.parentNode && node.parentNode !== virtualRoot) {
            var edge = symbolEl.__edge;
            if (!edge) {
                edge = symbolEl.__edge = new graphic.BezierCurve({
                    shape: getEdgeShape(seriesScope, sourceOldLayout, sourceOldLayout),
                    style: zrUtil.defaults({opacity: 0}, seriesScope.lineStyle)
                });
            }
            // ???? opacity

            graphic.updateProps(edge, {
                shape: getEdgeShape(seriesScope, sourceLayout, targetLayout),
                style: {opacity: 1}
            }, seriesModel);

            group.add(edge);
        }

        // if (node.isExpand === false && node.children.length !== 0) {
        //     symbolEl.getSymbolPath().setStyle('fill', seriesScope.itemStyle.fill);
        // }

    }


    function removeNode(data, dataIndex, symbolEl, group, seriesModel, seriesScope) {
        var node = data.tree.getNodeByDataIndex(dataIndex);
        var virtualRoot = data.tree.root;
        var itemModel = node.getModel();
        var seriesScope = getTreeNodeStyle(node, itemModel, seriesScope);


        // FIXME
        // parentNode layout illegal?
        var source = node.parentNode === virtualRoot ? node : node.parentNode || node;
        // var source = node.parentNode || node;
        // var sourceLayout = source.getLayout();

        // do {
        //     var sourceLayout = source.getLayout();
        // } while(sourceLayout)
        var sourceLayout;
        while (sourceLayout = source.getLayout(), sourceLayout == null) {
            source = source.parentNode === virtualRoot ? source : source.parentNode || source;
        }

        graphic.updateProps(symbolEl, {
            position: [sourceLayout.x + 1, sourceLayout.y + 1],
        }, seriesModel, function () {
            group.remove(symbolEl);
        });

        graphic.updateProps(symbolEl.getSymbolPath(), {
            style: {
                opacity: 0
            }
        }, seriesModel, function () {
            group.remove(symbolEl);
            data.setItemGraphicEl(dataIndex, null);
        });


        var edge = symbolEl.__edge;
        if (edge) {
            graphic.updateProps(edge, {
                shape: getEdgeShape(seriesScope, sourceLayout, sourceLayout),
                style: {
                    opacity: 0
                }
            }, seriesModel, function () {
                group.remove(edge);
            });
        }
    }

    function getEdgeShape(seriesScope, sourceLayout, targetLayout) {
        var x1 = sourceLayout.x;
        var y1 = sourceLayout.y;
        var x2 = targetLayout.x;
        var y2 = targetLayout.y;
        var cpx1;
        var cpy1;
        var cpx2;
        var cpy2;
        var orient = seriesScope.orient;

        if (seriesScope.layout === 'radial') {

            var radialCoor1 = radialCoordinate(x1, y1);
            var radialCoor2 = radialCoordinate(x1, (y1 + y2) / 2);
            var radialCoor3 = radialCoordinate(x2, y1);
            var radialCoor4 = radialCoordinate(x2, y2);

            return {
                x1: radialCoor1.x,
                y1: radialCoor1.y,
                x2: radialCoor2.x,
                y2: radialCoor2.y,
                cpx1: radialCoor3.x,
                cpy1: radialCoor3.y,
                cpx2: radialCoor4.x,
                cpy2: radialCoor4.y
            };
        }
        else {

            if (orient === 'horizontal') {
                cpx1 = x1 + (x2 - x1) * seriesScope.curvature;
                cpy1 = y1;
                cpx2 = x2 + (x1 - x2) * seriesScope.curvature;
                cpy2 = y2;
            }
            if (orient === 'vertical') {
                cpx1 = x1;
                cpy1 = (y1 + y2) / 2;
                cpx2 = x2;
                cpy2 = y1;
            }
            return {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                cpx1: cpx1,
                cpy1: cpy1,
                cpx2: cpx2,
                cpy2: cpy2
            };
        }
    }


});