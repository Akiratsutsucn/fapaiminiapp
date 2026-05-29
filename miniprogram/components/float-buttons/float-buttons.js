"use strict";
Component({
    properties: { showTop: { type: Boolean, value: true } },
    methods: {
        onContact() { this.triggerEvent('contact'); },
        onTop() { this.triggerEvent('top'); },
    },
});
