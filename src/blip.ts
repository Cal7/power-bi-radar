/// <reference path="./visual.ts"/>

class Blip {
    private _name: string;
    get name() {
        return this._name;
    }
    set name(name: string) {
        this._name = name;
    }

    get id() {
        return this.name.replace(/\W/g, "").toLowerCase(); //Strip non-alphanumeric characters (then convert to lowercase)
    }

    private _ring: Ring;
    get ring() {
        return this._ring;
    }
    set ring(ring: Ring) {
        this._ring = ring;
    }

    private _sector: Sector;
    get sector() {
        return this._sector;
    }
    set sector(sector: Sector) {
        this._sector = sector;
    }

    private _description: string;
    get description() {
        return this._description;
    }
    set description(description: string) {
        this._description = description;
    }

    private _coordinates: { x: number, y: number };
    get coordinates() {
        return this._coordinates;
    }
    set coordinates(coordinates: { x: number, y: number }) {
        this._coordinates = coordinates;
    }

    constructor(name: string, ring: Ring, sector: Sector, description: string) {
        this.name = name;
        this.ring = ring;
        this.sector = sector;
        this.description = description;
    }
}