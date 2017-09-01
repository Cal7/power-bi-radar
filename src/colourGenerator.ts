/// <reference path="./visual.ts"/>

class ColourGenerator {
    private offset: number; //Ensures that the same colours are not generated every time
    private lastHue: number;

    constructor() {
        this.offset = Math.random() * 360;
        this.lastHue = this.offset;
    }

    public getColour() {
        //https://stackoverflow.com/a/5008241/6639282
        let goldenAngle = 360 * (Math.pow(1.61803399, -2));

        let h = (this.lastHue + goldenAngle) % 360;
        let s = 45;
        let l = 50;

        this.lastHue = h;

        return "hsl(" + h + "," + s + "%," + l + "%)";
    }
}