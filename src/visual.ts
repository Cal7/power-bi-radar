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
        private header: d3.Selection<HTMLElement>;
        private sidebar: d3.Selection<HTMLElement>;
        private svg: d3.Selection<SVGElement>;
        private radar: Radar;

        constructor(options: VisualConstructorOptions) {
            this.target = options.element;
            this.header = d3.select(this.target).append("section")
                .attr("id", "header")
                .style("height", "10%");
            this.sidebar = d3.select(this.target).append("section")
                .attr("id", "sidebar")
                .style({
                    float: "left",
                    width: "20%",
                    height: "90%"
                });
            this.svg = d3.select(this.target).append("section")
                .attr("id", "svg-container")
                .style({
                    float: "right",
                    width: "80%",
                    height: "90%"
                })
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
                return column.displayName;
            });
            let nameIndex = columnMap.indexOf("name");
            let descriptionIndex = columnMap.indexOf("description");
            let sectorIndex = columnMap.indexOf("sector");
            let ringIndex = columnMap.indexOf("ring");
            let isNewIndex = columnMap.indexOf("isNew");
            let colourIndex = columnMap.indexOf("colour");

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
                .attr("class", "sector")
                .on("mouseover", function () {
                    self.selectSector(sector);
                })
                .on("mouseout", function () {
                    self.deselectSector();
                });

            self.radar.rings.forEach(function (ring) {
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
         * Gets called when a sector is clicked on. Focuses on the sector and changes the sidebar to display info about the sector
         * @param sector
         */
        private selectSector(sector) {
            let self = this;

            //Remove the current contents of the sidebar
            this.sidebar.selectAll("*").remove();

            sector.blips.forEach(function (blip) {
                //If this blip's ring does not yet have a container element inside the sidebar, create it
                if (self.sidebar.select("#ring-" + blip.ring.order).empty()) {
                    let ringDiv = self.sidebar.append("div")
                        .attr("id", "ring-" + blip.ring.order);

                    ringDiv.append("h3")
                        .text(blip.ring.name);
                    ringDiv.append("ul");
                }

                let ringDiv = self.sidebar.select("#ring-" + blip.ring.order);
                let li = ringDiv.select("ul").append("li");
                li.append("div")
                    .html(blip.number + ". " + blip.name + (blip.isNew ? " <i>(new)</i>" : ""))
                    .classed("item-name", true);
                if (blip.description) {
                    li.append("div")
                        .html(blip.description)
                        .classed("item-description", true)
                        .style({
                            "border-color": "black",
                            "border-style": "solid",
                            "border-width": "1px 0px"
                        });
                }
            });

            //Grey all the buttons in the header apart from this sector's button
            this.header.select("#" + sector.id + "-button")
                .style({
                    background: sector.colour,
                    color: "white"
                });
            this.header.selectAll(":not(#" + sector.id + "-button)")
                .style({
                    background: "#eeeeee",
                    color: "black"
                });

            //Decrease the opacity of all sectors apart from this one
            this.svg.select("#sectors .sector#sector-" + sector.id)
                .style("opacity", 1);
            this.svg.selectAll("#sectors .sector:not(#sector-" + sector.id + ")")
                .style("opacity", 0.3);
        }

        /**
         * Returns the visual to its "normal" state when a particular sector should no longer be focused on
         */
        private deselectSector() {
            this.plotHeader();
            this.plotSidebar();
            this.svg.selectAll("#sectors .sector")
                .style("opacity", 1);
        }

        /**
         * Draws all the sector lines onto the SVG element
         */
        private plotSectorLines() {
            let self = this;
            this.radar.sectors.forEach(function (sector) {
                self.plotSectorLine(sector);
            });
        }

        /**
         * Plots white lines to show the beginning and end of a sector
         * @param sector
         */
        private plotSectorLine(sector: Sector) {
            let relativeStartCoordinates = { x: 0, y: 0 };
            let relativeEndCoordinates = this.polarToCartesian({
                distance: this.calculateMaxRadius(),
                angle: sector.startAngle
            });

            let absoluteStartCoordinates = this.convertRelativeCoordinates({ x: 0, y: 0 });
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
            let min_angle = sector.startAngle + (Math.PI / 16); //The pi/16 ensures the point returned does not lay exactly on an axis where it would be covered up
            let max_angle = sector.endAngle - (Math.PI / 16);
            let angle = Math.random() * (max_angle - min_angle) + min_angle; //Random angle between min_angle and max_angle

            let min_distance = this.calculateMaxRadius() * (ring.order - 1) / 4;
            let max_distance = this.calculateMaxRadius() * ring.order / 4;
            if (min_distance === 0) {
                min_distance = max_distance / 2; //Ensure the point cannot be plotted at the very center, if it is in the central ring
            }
            let distance = Math.random() * (max_distance - min_distance) + min_distance;

            return this.polarToCartesian({ distance: distance, angle: angle });
        }

        /**
         * Draws all blips onto the SVG element
         */
        private plotBlips() {
            let self = this;
            this.radar.sectors.forEach(function (sector) {
                sector.blips.forEach(function (blip) {
                    let point = self.generatePoint(sector, blip.ring);
                    self.plotBlip(blip, point, sector.colour, self.svg.select("#sectors #sector-" + sector.id));
                });
            });
        }

        /**
         * Draws a blip onto the SVG element
         * @param blip
         * @param coordinates
         */
        private plotBlip(blip: Blip, coordinates: { x: number, y: number }, colour: string, sectorGroup: d3.Selection<Element>) {
            let self = this;
            let absoluteCoordinates = this.convertRelativeCoordinates(coordinates);

            let blipGroup = sectorGroup.select(".blips").append("g")
                .attr("class", "blip")
                .on("mouseover", function () {
                    self.svg.append("text")
                        .attr("id", "blip-mouseover")
                        .attr("x", absoluteCoordinates.x)
                        .attr("y", absoluteCoordinates.y - self.calculateBlipRadius() * 2)
                        .text(blip.name)
                        .attr("text-anchor", "middle");
                })
                .on("mouseout", function () {
                    self.svg.select("#blip-mouseover").remove();
                });
            blipGroup.append("circle")
                .attr("cx", absoluteCoordinates.x)
                .attr("cy", absoluteCoordinates.y)
                .attr("r", this.calculateBlipRadius())
                .attr("fill", colour);
            blipGroup.append("text")
                .attr("x", absoluteCoordinates.x)
                .attr("y", absoluteCoordinates.y + self.calculateBlipRadius() / 2)
                .text(blip.number)
                .attr("text-anchor", "middle")
                .attr("fill", "white");
        }

        /**
         * Calculates the radius that each blip should have
         */
        private calculateBlipRadius() {
            return this.calculateMaxRadius() / 30;
        }

        /**
         * Renders the names of the rings
         * @param rings
         */
        private plotRingAxes() {
            let self = this;
            let ringAxesGroup = this.svg.select("#axes");
            this.radar.rings.forEach(function (ring) {
                let innerRadius = self.calculateMaxRadius() * (ring.order - 1) / 4;
                let outerRadius = self.calculateMaxRadius() * ring.order / 4;

                let textRelativeCoordinates = {
                    x: (innerRadius + outerRadius) / 2, //The middle of the text should be at the average of the inner and outer radius
                    y: -1 * self.calculateSectorLineWidth() / 2 //If the y were just 0 then it would be slightly above the sector line, so this vertically aligns it within the line
                };
                let textAbsoluteCoordinates = self.convertRelativeCoordinates(textRelativeCoordinates);
                ringAxesGroup.append("text")
                    .text(ring.name)
                    .attr("x", textAbsoluteCoordinates.x)
                    .attr("y", textAbsoluteCoordinates.y)
                    .attr("text-anchor", "middle");
            });
        }

        /**
         * Displays buttons for each sector inside the header
         * @param sectors
         */
        private plotHeader() {
            //Remove the existing header
            this.header.selectAll("*").remove();

            let self = this;
            //Plot the buttons of each sector
            this.radar.sectors.forEach(function (sector) {
                self.header.append("div")
                    .text(sector.name)
                    .style({
                        background: sector.colour,
                        "border-radius": "5px",
                        color: "white",
                        display: "inline-block",
                        "margin-right": "20px",
                        padding: "10px 20px"
                    })
                    .attr("id", sector.id + "-button")
                    .on("mouseover", function () {
                        self.selectSector(sector);
                    })
                    .on("mouseout", function () {
                        self.deselectSector();
                    });
            });
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
                self.sidebar.append("h3")
                    .text(sector.name)
                    .style("color", sector.colour);

                let ul = self.sidebar.append("ul");
                sector.blips.forEach(function (blip) {
                    ul.append("li")
                        .text(blip.number + ". " + blip.name);
                });
            });
        }

        public update(options: VisualUpdateOptions) {
            let self = this;

            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

            this.radar = this.transformData(options.dataViews[0].table);
            console.log(this.radar);

            //"Clear" the previously drawn SVG
            this.svg.selectAll("*").remove();
            
            this.svg.attr({
                width: this.calculateMaxRadius() * 2,
                height: this.calculateMaxRadius() * 2
            });

            this.svg.append("g").attr("id", "sectors");
            this.plotSectors();

            this.svg.append("g").attr("id", "lines");
            this.plotSectorLines();

            this.plotBlips();

            this.svg.append("g").attr("id", "axes");
            this.plotRingAxes();
            
            this.plotHeader();
            
            this.plotSidebar();

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