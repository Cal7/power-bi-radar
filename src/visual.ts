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

    //Get lodash working... Hacky solution from https://community.powerbi.com/t5/Developer/Adding-a-static-js-script-to-a-custom-visualization/td-p/104957
    let _ = (<any>window)._;

    export class Visual implements IVisual {
        private target: HTMLElement;
        private updateCount: number;
        private settings: VisualSettings;
        private sidebar: d3.Selection<HTMLElement>;
        private svg: d3.Selection<SVGElement>;
        private radar: Radar;

        constructor(options: VisualConstructorOptions) {
            this.target = options.element;
            this.sidebar = d3.select(this.target).append("section")
                .attr("id", "sidebar");
            this.svg = d3.select(this.target).append("section")
                .attr("id", "svg-container")
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
            //Maybe at a later date these will be defined in the data instead of hardcoded
            let ringMap = {
                Accelerate: new Ring("Accelerate", 1, "#bababa"),
                Progress: new Ring("Progress", 2, "#cacaca"),
                Monitor: new Ring("Monitor", 3, "#dadada"),
                Pause: new Ring("Pause", 4, "#eeeeee")
            };

            //Because the order of the columns is not guaranteed to remain consistent, we need to determine the indices of all the fields before we can fetch their values
            let columnMap = table.columns.map(function (column) {
                return Object.keys(column.roles)[0];
            });
            let nameIndex = columnMap.indexOf("name");
            let descriptionIndex = columnMap.indexOf("description");
            let sectorIndex = columnMap.indexOf("sector");
            let ringIndex = columnMap.indexOf("ring");
            let isNewIndex = columnMap.indexOf("isNew");
            let colourIndex = columnMap.indexOf("colour");

            let ringNames = table.rows;
            console.log(ringNames);

            let sectors = {};
            table.rows.forEach(function (v, i) {
                let name = v[nameIndex];
                let description = v[descriptionIndex];
                let sectorName = v[sectorIndex];
                let ringName = v[ringIndex];
                let isNew = v[isNewIndex];
                let colour = v[colourIndex];

                if (!sectors[sectorName]) {
                    sectors[sectorName] = new Sector(sectorName, colour);
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
         * Returns the dimensions of the "drawing area" of the SVG element
         */
        private getDimensions() {
            return {
                width: 2,
                height: 2
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
            let svgContainer = d3.select(this.target).select("#svg-container").node() as HTMLElement;
            let svgContainerDimensions = {
                width: svgContainer.getBoundingClientRect().width,
                height: svgContainer.getBoundingClientRect().height
            };

            return Math.min(svgContainerDimensions.width, svgContainerDimensions.height) / 2;
        }

        /**
         * Converts coordinates relative to the radar's center into coordinates relative to the top left of the SVG container
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
         * Draws all the radar's sectors onto the SVG element
         */
        private plotSectors() {
            let self = this;
            this.radar.sectors.forEach(function (sector) {
                self.plotSector(sector);
            });
        }

        /**
         * Draws a sector onto the SVG element
         * @param sector
         * @param rings
         */
        private plotSector(sector: Sector) {
            let self = this;

            let sectorGroup = this.svg.select("#sectors").append("g")
                .attr("id", "sector-" + sector.id)
                .attr("class", "sector");

            self.radar.rings.forEach(function (ring) {
                let arc = d3.svg.arc()
                    .innerRadius((ring.order - 1) / 4)
                    .outerRadius(ring.order / 4)
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
         * Determines the width that the white line at the start of each sector should be
         */
        private calculateSectorLineWidth() {
            return 0.01;
        }

        /**
         * Iterates over every blip on the radar and generates coordinates for it
         */
        private setBlipCoordinates() {
            let self = this;

            //We need to keep track of the coordinates of all blips so we can check whether a spot is available or not
            let allCoordinates: { x: number, y: number }[] = [];

            this.radar.sectors.forEach(function (sector) {
                sector.blips.forEach(function (blip) {
                    let coordinates = self.generateBlipCoordinates(sector, blip.ring, allCoordinates);
                    blip.coordinates = coordinates;
                    allCoordinates.push(coordinates);
                });
            });
        }

        /**
         * Given a sector and a ring to which a point belongs, randomly generates coordinates for the point
         * @param sector
         * @param ring
         */
        private generateBlipCoordinates(sector: Sector, ring: Ring, allCoordinates: { x: number, y: number }[]) {
            let min_angle = sector.startAngle + (Math.PI / 16); //The pi/16 ensures the point returned does not lay exactly on an axis where it would be covered up
            let max_angle = sector.endAngle - (Math.PI / 16);

            let min_distance = (ring.order - 1) / 4;
            let max_distance = ring.order / 4;
            if (min_distance === 0) {
                min_distance = max_distance / 2; //Ensure the point cannot be plotted at the very center, if it is in the central ring
            }

            let coordinates: { x: number, y: number };
            let attemptCount = 0; //Keeps track of how many times we have generated coordinates and had to discard them for being too close to another blip
            do {
                let angle = Math.random() * (max_angle - min_angle) + min_angle; //Random angle between min_angle and max_angle
                let distance = Math.random() * (max_distance - min_distance) + min_distance;

                coordinates = this.polarToCartesian({ distance: distance, angle: angle });

                attemptCount++;
                if (attemptCount >+ 10) { //If ten successive attempts fail, it is probable that there's simply nowhere to put it, so it should just be allowed to overlap another blip
                    break;
                }
            } while (!this.coordinatesAreFree(coordinates, allCoordinates));

            return coordinates;
        }

        /**
         * Determines whether the space at particular coordinates is empty or whether a blip is already plotted there
         * @param coordinates
         */
        private coordinatesAreFree(coordinates: { x: number, y: number }, allCoordinates: { x: number, y: number }[]) {
            let self = this;

            let blipRadius = this.calculateBlipRadius();

            //Go through every existing blip's coordinates, and return whether they are all a sufficient distance away or not
            return allCoordinates.every(function (currentCoordinates) {
                return self.distanceBetweenPoints(coordinates, currentCoordinates) > blipRadius * 2.1; //2.1 rather than 2 so that two blips cannot be touching each other
            });
        }

        /**
         * Calculates the distance between two points on a Cartesian plane
         * @param coordinates1
         * @param coordinates2
         */
        private distanceBetweenPoints(coordinates1: { x: number, y: number }, coordinates2: { x: number, y: number }) {
            return Math.pow(
                Math.pow(
                    coordinates1.x - coordinates2.x,
                    2
                )
                + Math.pow(
                    coordinates1.y - coordinates2.y,
                    2
                ),
                0.5
            );
        }

        /**
         * Draws all blips onto the SVG element
         */
        private plotBlips() {
            let self = this;
            this.radar.sectors.forEach(function (sector) {
                sector.blips.forEach(function (blip) {
                    self.plotBlip(blip, sector.colour, self.svg.select("#sectors #sector-" + sector.id));
                });
            });
        }

        /**
         * Draws a blip onto the SVG element
         * @param blip
         * @param coordinates
         */
        private plotBlip(blip: Blip, colour: string, sectorGroup: d3.Selection<Element>) {
            let self = this;
            let absoluteCoordinates = this.convertRelativeCoordinates(blip.coordinates);

            let blipGroup = sectorGroup.select(".blips").append("g")
                .attr("class", "blip");
            blipGroup.append("circle")
                .attr("cx", absoluteCoordinates.x)
                .attr("cy", absoluteCoordinates.y)
                .attr("r", this.calculateBlipRadius())
                .attr("fill", colour);
        }

        /**
         * Calculates the radius that each blip should have
         */
        private calculateBlipRadius() {
            return 0.035;
        }

        /**
         * Displays information about the sectors in the visual's sidebar
         * @param sectors
         */
        private plotSidebar() {
            //Remove the existing sidebar
            this.sidebar.selectAll("*").remove();

            let self = this;

            this.radar.sectors.forEach(function (sector) {
                self.sidebar.append("button")
                    .text(sector.name)
                    .style({
                        background: sector.colour
                    });
            });
        }

        public update(options: VisualUpdateOptions) {
            console.time("update");

            let self = this;

            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

            this.radar = this.transformData(options.dataViews[0].table);
            console.log(this.radar);

            //"Clear" the previously drawn SVG
            this.svg.selectAll("*").remove();
            
            this.svg.attr({
                width: this.calculateMaxRadius() * 2,
                height: this.calculateMaxRadius() * 2,
                viewBox: "0 0 2 2"
            });

            this.svg.append("g").attr("id", "sectors");
            this.plotSectors();

            this.setBlipCoordinates();
            this.plotBlips();
            
            this.plotSidebar();

            this.updateCount++;

            console.timeEnd("update");
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