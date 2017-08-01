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

        get blips() {
            return this.sectors.reduce(function (blips, sector) {
                return blips.concat(sector.blips);
            }, []);
        }

        get rings() {
            return this.blips.map(function (blip) {
                return blip.ring;
            }).filter(function (value, index, self) {
                return self.indexOf(value) === index;
                });
        }

        private calculateSectorAngles() {
            return 2 * Math.PI / this.sectors.length;
        }
        public setSectorAngles() {
            let angle = this.calculateSectorAngles();

            this.sectors.forEach(function (sector, index) {
                sector.startAngle = index * angle;
                sector.endAngle = sector.startAngle + angle;
            });
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

        private _endAngle: number;
        get endAngle() {
            return this._endAngle;
        }
        set endAngle(angle: number) {
            this._endAngle = angle;
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

        private _colour: string;
        get colour() {
            return this._colour;
        }
        set colour(colour: string) {
            this._colour = colour;
        }

        constructor(name: string, order: number, colour: string) {
            this.name = name;
            this.order = order;
            this.colour = colour;
        }
    }

    /**
     * Transforms the data inside a data view into a form that's necessary to work with
     * @param dataView
     */
    function transformData(data) {
        let radar = new Radar();

        //ringMap will hold all the rings, indexed by their name
        let ringMap = {
            Accelerate: new Ring("Accelerate", 1, "#bababa"),
            Progress: new Ring("Progress", 2, "#cacaca"),
            Monitor: new Ring("Monitor", 3, "#dadada"),
            Pause: new Ring("Pause", 4, "#eeeeee")
        };

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

        radar.setSectorAngles();

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

        /**
         * Extracts the dimensions of an SVG element
         * @param svg
         */
        private getDimensions(svg: d3.Selection<SVGElement>){
            return {
                width: parseInt(svg.attr("width")),
                height: parseInt(svg.attr("height"))
            };
        }

        /**
         * Gets the coordinates of the center of the visual
         * @param svg
         */
        private calculateCenter(svg: d3.Selection<SVGElement>) {
            let dimensions = this.getDimensions(svg);

            return {
                x: dimensions.width / 2,
                y: dimensions.height / 2
            };
        }

        /**
         * For if the visual is not square, as the max radius cannot be greater than the smallest side of the visual
         * @param svg
         */
        private calculateMaxRadius(svg: d3.Selection<SVGElement>) {
            let dimensions = this.getDimensions(svg);

            return Math.min(dimensions.width, dimensions.height) / 2;
        }

        /**
         * Draws the sectors onto the SVG element
         * @param sectors
         * @param svg
         */
        private plotSectors(sectors: Sector[], rings: Ring[], svg: d3.Selection<SVGElement>) {
            let self = this;

            sectors.forEach(function (sector) {
                let sectorGroup = svg.append("g");

                let arc = d3.svg.arc()
                    .innerRadius(0)
                    .outerRadius(self.calculateMaxRadius(svg))
                    .startAngle(sector.startAngle)
                    .endAngle(sector.endAngle);

                sectorGroup.append("path")
                    .attr("d", <any>arc)
                    .style("fill", "#dbdbdb")
                    .attr("transform", "translate(" + self.calculateCenter(svg).x + ", " + self.calculateCenter(svg).y + ")");
            });
        }

        public update(options: VisualUpdateOptions) {
            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

            let radar = transformData(options.dataViews[0].table.rows);
            console.log(radar);

            let width = options.viewport.width;
            let height = options.viewport.height;

            this.svg.attr({
                width: width,
                height: height
            });

            this.plotSectors(radar.sectors, radar.rings, this.svg);

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