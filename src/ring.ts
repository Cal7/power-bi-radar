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