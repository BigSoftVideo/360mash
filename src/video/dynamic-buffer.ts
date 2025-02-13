import assert from "assert";

export class DynamicBuffer {
    private buffer: Buffer;
    private length: number;

    constructor(initialCapacity = 512) {
        this.buffer = Buffer.alloc(initialCapacity);
        this.length = 0;
    }

    reserve(addittionalCapacity: number) {
        if (addittionalCapacity <= 0) {
            return;
        }
        let capacity = this.getCapacity();
        const roundedAddittionalCapacity = Math.ceil(addittionalCapacity / capacity) * capacity;
        capacity += roundedAddittionalCapacity;
        const newBuffer = Buffer.alloc(capacity);
        newBuffer.set(this.buffer);
        this.buffer = newBuffer;
    }

    append(data: Buffer | number[]) {
        const freeCapacity = this.getCapacity() - this.length;
        const capacityNeeded = data.length - freeCapacity;
        this.reserve(capacityNeeded);
        this.buffer.set(data, this.length);
        this.length += data.length;
        assert(this.length <= this.getCapacity());
    }

    getCapacity(): number {
        return this.buffer.length;
    }

    getLength(): number {
        return this.length;
    }

    clear() {
        this.length = 0;
    }

    asBuffer(): Buffer {
        return this.buffer.slice(0, this.length);
    }

    split(splitOffset: number): DynamicBuffer {
        if (splitOffset > this.length) {
            throw new Error("Split offset is out of bounds");
        }
        const firstHalf = new DynamicBuffer(splitOffset);
        firstHalf.append(this.buffer.slice(0, splitOffset));
        this.buffer.set(this.buffer.slice(splitOffset), 0);
        this.length -= splitOffset;
        return firstHalf
    }
}
