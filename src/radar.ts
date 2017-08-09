/// <reference path="./visual.ts"/>

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

    //Get all blips in the radar. As the blips belong to a sector and not the radar,
    //loop through the radar's sectors and then go through each sector's blips.
    get blips() {
        return this.sectors.reduce(function (blips, sector) {
            return blips.concat(sector.blips);
        }, []);
    }

    //Get all rings in the radar. This is done by first getting the ring property from all blips,
    //and then filtering just the unique values
    get rings() {
        return this.blips.map(function (blip) {
            return blip.ring;
        }).filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });
    }

    //Calculate the angle each sector should have (in radians), e.g. if 4 sectors
    //then each should be a quarter of the radar, or pi/2
    private calculateSectorAngles() {
        return 2 * Math.PI / this.sectors.length;
    }
    //Go through all the sectors and set their start and end angles
    public setSectorAngles() {
        let angle = this.calculateSectorAngles();

        this.sectors.forEach(function (sector, index) {
            sector.startAngle = index * angle;
            sector.endAngle = sector.startAngle + angle;
        });
    }
}