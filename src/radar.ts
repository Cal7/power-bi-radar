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