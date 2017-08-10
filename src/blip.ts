/// <reference path="./visual.ts"/>

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

    private _coordinates: { x: number, y: number };
    get coordinates() {
        return this._coordinates;
    }
    set coordinates(coordinates: { x: number, y: number }) {
        this._coordinates = coordinates;
    }

    constructor(name: string, number: number, ring: Ring, isNew: boolean, description: string) {
        this.name = name;
        this._number = number;
        this.ring = ring;
        this.isNew = isNew;
        this.description = description;
    }
}