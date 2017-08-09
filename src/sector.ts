/// <reference path="./visual.ts"/>

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