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

    //Not sure why this is necessary for lodash but not for d3... but it got things working.
    //Hacky solution from https://community.powerbi.com/t5/Developer/Adding-a-static-js-script-to-a-custom-visualization/td-p/104957
    let _ = (<any>window)._;

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

        get id() {
            return this.name.replace(/\W/g, "").toLowerCase();
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

        private _colour: string;
        get colour() {
            return this._colour;
        }
        set colour(colour: string) {
            this._colour = colour;
        }

        private _blips: Blip[];
        get blips() {
            return this._blips;
        }
        public addBlip(blip: Blip) {
            this.blips.push(blip);
        }

        constructor(name: string, colour: string) {
            this.name = name;
            this.colour = colour;
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

        private _number: number;
        get number() {
            return this._number;
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

        constructor(name: string, number: number, ring: Ring, isNew: boolean, description: string) {
            this.name = name;
            this._number = number;
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

    export class Visual implements IVisual {
        private target: HTMLElement;
        private updateCount: number;
        private settings: VisualSettings;
        private sidebar: d3.Selection<HTMLElement>;
        private svg: d3.Selection<SVGElement>;

        constructor(options: VisualConstructorOptions) {
            this.target = options.element;
            this.sidebar = d3.select(this.target)
                .append("section").attr("id", "sidebar").style("float", "left").style("width", "20%").style("height", "100%");
            this.svg = d3.select(this.target)
                .append("section").attr("id", "svg-container").style("float", "right").style("width", "80%").style("height", "100%")
                .append("svg");
            this.updateCount = 0;
        }

        /**
         * Transforms the data inside a data view into a form that's necessary to work with
         * @param data
         */
        private transformData(table) {
            let self = this;
            let radar = new Radar();

            //ringMap will hold all the rings, indexed by their name
            let ringMap = {
                Accelerate: new Ring("Accelerate", 1, "#bababa"),
                Progress: new Ring("Progress", 2, "#cacaca"),
                Monitor: new Ring("Monitor", 3, "#dadada"),
                Pause: new Ring("Pause", 4, "#eeeeee")
            };

            //Because the order of the columns is not guaranteed to remain consistent, we need to determine the indices of all the fields before we can fetch their values
            let columnMap = table.columns.map(function (column) {
                return column.displayName;
            });
            let nameIndex = columnMap.indexOf("name");
            let descriptionIndex = columnMap.indexOf("description");
            let sectorIndex = columnMap.indexOf("sector");
            let ringIndex = columnMap.indexOf("ring");
            let isNewIndex = columnMap.indexOf("isNew");

            let sectors = {};
            table.rows.forEach(function (v, i) {
                let name = v[nameIndex];
                let description = v[descriptionIndex];
                let sectorName = v[sectorIndex];
                let ringName = v[ringIndex];
                let isNew = v[isNewIndex];

                if (!sectors[sectorName]) {
                    sectors[sectorName] = new Sector(sectorName, self.generateColour());
                }
                sectors[sectorName].addBlip(new Blip(name, i + 1, ringMap[ringName], isNew, description));
            });

            for (let index in sectors) {
                radar.addSector(sectors[index]);
            }

            radar.setSectorAngles();

            return radar;
        }

        /**
         * Generates a random hex codes, used to determine what colour the blips of each sector should be
         */
        private generateColour() {
            return "#" + Math.floor(Math.random() * 16777215).toString(16);
        }

        /**
         * Extracts the dimensions of the visual's SVG container
         */
        private getDimensions() {
            return {
                width: (this.svg.node() as HTMLElement).getBoundingClientRect().width,
                height: (this.svg.node() as HTMLElement).getBoundingClientRect().height
            };
        }

        /**
         * Gets the coordinates of the center of the visual
         */
        private calculateCenter() {
            let dimensions = this.getDimensions();

            return {
                x: dimensions.width / 2,
                y: dimensions.height / 2
            };
        }

        /**
         * For if the visual is not square, as the max radius cannot be greater than the smallest side of the visual
         */
        private calculateMaxRadius() {
            let dimensions = this.getDimensions();

            return Math.min(dimensions.width, dimensions.height) / 2;
        }

        /**
         * Converts coordinates relative to the center of the radar into coordinates relative to the top left of the SVG container
         * @param coordinates
         */
        private convertRelativeCoordinates(coordinates: { x: number, y: number }) {
            let center = this.calculateCenter();

            return {
                x: coordinates.x + center.x,
                y: center.y - coordinates.y
            }
        };

        /**
         * Converts an angle and distance to an x,y pair. Due to the way d3 plots arcs, the angle is taken clockwise from the positive y axis rather than the standard convention
         * @param polar
         */
        private polarToCartesian(polar: { distance: number, angle: number }) {
            return {
                x: polar.distance * Math.sin(polar.angle),
                y: polar.distance * Math.cos(polar.angle)
            };
        }

        /**
         * Draws a sector onto the SVG element
         * @param sector
         * @param rings
         */
        private plotSector(sector: Sector, rings: Ring[]) {
            let self = this;

            let sectorGroup = this.svg.select("#sectors").append("g")
                .attr("id", "sector-" + sector.id)
                .attr("class", "sector")
                .on("mouseover", function () { //Reduce the opacity of the the other sectors to make this one more prominent
                    self.svg.selectAll("#sectors .sector:not(#sector-" + sector.id + ")")
                        .style("opacity", 0.3);
                }).
                on("mouseout", function () {
                    self.svg.selectAll(".sector")
                        .style("opacity", 1)
                });

            rings.forEach(function (ring) {
                let arc = d3.svg.arc()
                    .innerRadius(self.calculateMaxRadius() * (ring.order - 1) / 4)
                    .outerRadius(self.calculateMaxRadius() * ring.order / 4)
                    .startAngle(sector.startAngle)
                    .endAngle(sector.endAngle);

                sectorGroup.append("path")
                    .attr("d", <any>arc)
                    .style("fill", ring.colour)
                    .attr("transform", "translate(" + self.calculateCenter().x + ", " + self.calculateCenter().y + ")");
            });

            sectorGroup.append("g").attr("class", "blips");
        }

        /**
         * Plots a white line marking the beginning of a sector
         * @param sector
         */
        private plotSectorLine(sector: Sector) {
            let absoluteStartCoordinates = this.convertRelativeCoordinates({ x: 0, y: 0 });

            let relativeEndCoordinates = {
                x: this.calculateMaxRadius() * Math.cos(sector.startAngle),
                y: this.calculateMaxRadius() * Math.sin(sector.startAngle)
            };
            let absoluteEndCoordinates = this.convertRelativeCoordinates(relativeEndCoordinates);

            this.svg.select("#lines").append("line")
                .attr("x1", absoluteStartCoordinates.x)
                .attr("y1", absoluteStartCoordinates.y)
                .attr("x2", absoluteEndCoordinates.x)
                .attr("y2", absoluteEndCoordinates.y)
                .attr("stroke-width", this.calculateSectorLineWidth())
                .attr("stroke", "white");
        }

        /**
         * Determines the width that the white line at the start of each sector should be
         */
        private calculateSectorLineWidth() {
            return this.calculateMaxRadius() / 25;
        }

        /**
         * Given a sector and a ring to which a point belongs, randomly generates coordinates for the point
         * @param sector
         * @param ring
         */
        private generatePoint(sector: Sector, ring: Ring) {
            let min_angle = sector.startAngle;
            let max_angle = sector.endAngle;
            let angle = Math.random() * (max_angle - min_angle) + min_angle;

            let min_distance = this.calculateMaxRadius() * (ring.order - 1) / 4;
            let max_distance = this.calculateMaxRadius() * ring.order / 4;
            let distance = Math.random() * (max_distance - min_distance) + min_distance;

            return this.polarToCartesian({ distance: distance, angle: angle });
        }

        /**
         * Draws a blip on the graph
         * @param blip
         * @param coordinates
         */
        private plotBlip(blip: Blip, coordinates: { x: number, y: number }, colour: string, sectorGroup: d3.Selection<Element>) {
            let self = this;
            let absoluteCoordinates = this.convertRelativeCoordinates(coordinates);

            let blipGroup = sectorGroup.select(".blips").append("g")
                .attr("class", "blip");
            blipGroup.append("circle")
                .attr("cx", absoluteCoordinates.x)
                .attr("cy", absoluteCoordinates.y)
                .attr("r", this.calculateBlipRadius())
                .attr("fill", colour)
                .on("mouseover", function () {
                    self.svg.append("text")
                        .attr("id", "blip-mouseover")
                        .attr("x", absoluteCoordinates.x)
                        .attr("y", absoluteCoordinates.y - self.calculateBlipRadius())
                        .text(blip.name);
                })
                .on("mouseout", function () {
                    self.svg.select("#blip-mouseover").remove();
                });
            blipGroup.append("text")
                .attr("x", absoluteCoordinates.x)
                .attr("y", absoluteCoordinates.y + self.calculateBlipRadius() / 2)
                .text(blip.number)
                .attr("text-anchor", "middle");
        }

        /**
         * Calculates the radius that each blip should have
         */
        private calculateBlipRadius() {
            let radius = this.calculateMaxRadius();

            return radius / 40;
        }

        /**
         * Renders the names of the rings
         * @param rings
         */
        private plotRingAxes(rings: Ring[]) {
            let self = this;
            let ringAxesGroup = this.svg.select("#axes");
            rings.forEach(function (ring) {
                let textRelativeCoordinates = {
                    x: self.calculateMaxRadius() * (ring.order - 1) / 4,
                    y: -1 * self.calculateSectorLineWidth() / 2 //If the y were just 0 then it would be slightly above the sector line, so this vertically aligns it within the line
                };
                let textAbsoluteCoordinates = self.convertRelativeCoordinates(textRelativeCoordinates);
                ringAxesGroup.append("text")
                    .text(ring.name)
                    .attr("x", textAbsoluteCoordinates.x)
                    .attr("y", textAbsoluteCoordinates.y);
            });
        }

        /**
         * Displays information about the sectors in the visual's sidebar
         * @param sectors
         */
        private plotSidebar(sectors: Sector[]) {
            let self = this;
            sectors.forEach(function (sector) {
                self.sidebar.append("h3").text(sector.name).style("color", sector.colour);

                let ul = self.sidebar.append("ul").style("padding-left", 0);
                sector.blips.forEach(function (blip) {
                    ul.append("li").text(blip.name + " (" + blip.number + ")");
                });
            });
        }

        public update(options: VisualUpdateOptions) {
            let self = this;

            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

            let radar = this.transformData(options.dataViews[0].table);
            console.log(radar);

            //"Clear" the previously drawn SVG
            this.svg.selectAll("*").remove();

            //The SVG should fill its container
            this.svg.style("width", "100%").style("height", "100%");

            this.svg.append("g").attr("id", "sectors");
            radar.sectors.forEach(function (sector) {
                self.plotSector(sector, radar.rings);
            });

            this.svg.append("g").attr("id", "lines");
            radar.sectors.forEach(function (sector) {
                self.plotSectorLine(sector);
            });

            radar.sectors.forEach(function (sector) {
                sector.blips.forEach(function (blip) {
                    let point = self.generatePoint(sector, blip.ring);
                    self.plotBlip(blip, point, sector.colour, self.svg.select("#sectors #sector-" + sector.id));
                });
            });

            this.svg.append("g").attr("id", "axes");
            this.plotRingAxes(radar.rings);

            this.sidebar.selectAll("*").remove();
            this.plotSidebar(radar.sectors);

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