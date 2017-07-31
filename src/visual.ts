/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    "use strict";

    class Radar {
        private _sectors: Sector[];
        get sectors() {
            return this._sectors;
        }
        public addSector(sector: Sector) {
            this.sectors.push(sector);
        }

        constructor() {
            this._sectors = [];
        }
    }

    class Sector {
        private _name: string;
        get name() {
            return this._name;
        }
        set name(name: string) {
            this._name = name;
        }

        private _startAngle: number;
        get startAngle() {
            return this._startAngle;
        }
        set startAngle(angle: number) {
            this._startAngle = angle;
        }

        private _blips: Blip[];
        get blips() {
            return this._blips;
        }
        public addBlip(blip: Blip) {
            this.blips.push(blip);
        }

        constructor(name: string) {
            this.name = name;
            this._blips = [];
        }
    }

    class Blip {
        private _name: string;
        get name() {
            return this._name;
        }
        set name(name: string) {
            this._name = name;
        }

        private _ring: Ring;
        get ring() {
            return this._ring;
        }
        set ring(ring: Ring) {
            this._ring = ring;
        }

        private _isNew: boolean;
        get isNew() {
            return this._isNew;
        }
        set isNew(isNew: boolean) {
            this._isNew = isNew;
        }

        private _description: string;
        get description() {
            return this._description;
        }
        set description(description: string) {
            this._description = description;
        }

        constructor(name: string, ring: Ring, isNew: boolean, description: string) {
            this.name = name;
            this.ring = ring;
            this.isNew = isNew;
            this.description = description;
        }
    }

    class Ring {
        private _name: string;
        get name() {
            return this._name;
        }
        set name(name: string) {
            this._name = name;
        }

        private _order: number;
        get order() {
            return this._order;
        }
        set order(order: number) {
            this._order = order;
        }

        constructor(name: string, order: number) {
            this.name = name;
            this.order = order;
        }
    }

    /**
     * Transforms the data inside a data view into a form that's necessary to work with
     * @param dataView
     */
    function transformData(data) {
        let radar = new Radar();

        //ringMap will hold all the rings, indexed by their name
        let ringMap = {};
        data.forEach(function (value, index) {
            let ringName = value[2];

            if (!ringMap[ringName]) {
                ringMap[ringName] = new Ring(ringName, 1);
            }
        });

        let sectors = {};
        data.forEach(function (v, i) {
            let name = v[0];
            let sectorName = v[1];
            let ringName = v[2];
            let description = v[3];
            let isNew = v[4];

            if (!sectors[sectorName]) {
                sectors[sectorName] = new Sector(sectorName);
            }
            sectors[sectorName].addBlip(new Blip(name, ringMap[ringName], isNew, description));
        });

        for (let index in sectors) {
            radar.addSector(sectors[index]);
        }
        
        return radar;
    }

    export class Visual implements IVisual {
        private target: HTMLElement;
        private updateCount: number;
        private settings: VisualSettings;
        private svg: d3.Selection<SVGElement>;

        constructor(options: VisualConstructorOptions) {
            this.target = options.element;
            this.svg = d3.select(this.target).append('svg');
            this.updateCount = 0;
        }

        public update(options: VisualUpdateOptions) {
            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

            let radar = transformData(options.dataViews[0].table.rows);
            console.log(radar);

            let width = options.viewport.width;
            let height = options.viewport.height;

            /**
             * Calculates the coordinates of the center of the plot
             */
            function center() {
                return {
                    x: width / 2,
                    y: height / 2
                };
            }

            this.svg.attr({
                width: width,
                height: height
            });

            this.updateCount++;
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        /** 
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the 
         * objects and properties you want to expose to the users in the property pane.
         * 
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}