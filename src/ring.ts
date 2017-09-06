/// <reference path="./visual.ts"/>

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

    private _colour: tinycolor;
    get colour() {
        return this._colour;
    }
    set colour(colour: tinycolor) {
        this._colour = colour;
    }

    constructor(name: string, order: number, colour: tinycolor) {
        this.name = name;
        this.order = order;
        this.colour = colour;
    }
}