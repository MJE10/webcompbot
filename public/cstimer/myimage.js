let drawPolygon = $.ctxDrawPolygon;
let nnnImage = (function() {
    let width = 30;

    let posit = [];
    let colors = ['#ff0', '#fa0', '#00f', '#fff', '#f00', '#0d0'];

    function face(f, size) {
        let offx = 10 / 9,
            offy = 10 / 9;
        if (f == 0) { //D
            offx *= size;
            offy *= size * 2;
        } else if (f == 1) { //L
            offx *= 0;
            offy *= size;
        } else if (f == 2) { //B
            offx *= size * 3;
            offy *= size;
        } else if (f == 3) { //U
            offx *= size;
            offy *= 0;
        } else if (f == 4) { //R
            offx *= size * 2;
            offy *= size;
        } else if (f == 5) { //F
            offx *= size;
            offy *= size;
        }

        for (let i = 0; i < size; i++) {
            let x = (f == 1 || f == 2) ? size - 1 - i : i;
            for (let j = 0; j < size; j++) {
                let y = (f == 0) ? size - 1 - j : j;
                drawPolygon(ctx, colors[posit[(f * size + y) * size + x]], [
                    [i, i, i + 1, i + 1],
                    [j, j + 1, j + 1, j]
                ], [width, offx, offy]);
            }
        }
    }

    /**
     *  f: face, [ D L B U R F ]
     *  d: which slice, in [0, size-1)
     *  q: [  2 ']
     */
    function doslice(f, d, q, size) {
        let f1, f2, f3, f4;
        let s2 = size * size;
        let c, i, j, k;
        if (f > 5) f -= 6;
        for (k = 0; k < q; k++) {
            for (i = 0; i < size; i++) {
                if (f == 0) {
                    f1 = 6 * s2 - size * d - size + i;
                    f2 = 2 * s2 - size * d - 1 - i;
                    f3 = 3 * s2 - size * d - 1 - i;
                    f4 = 5 * s2 - size * d - size + i;
                } else if (f == 1) {
                    f1 = 3 * s2 + d + size * i;
                    f2 = 3 * s2 + d - size * (i + 1);
                    f3 = s2 + d - size * (i + 1);
                    f4 = 5 * s2 + d + size * i;
                } else if (f == 2) {
                    f1 = 3 * s2 + d * size + i;
                    f2 = 4 * s2 + size - 1 - d + size * i;
                    f3 = d * size + size - 1 - i;
                    f4 = 2 * s2 - 1 - d - size * i;
                } else if (f == 3) {
                    f1 = 4 * s2 + d * size + size - 1 - i;
                    f2 = 2 * s2 + d * size + i;
                    f3 = s2 + d * size + i;
                    f4 = 5 * s2 + d * size + size - 1 - i;
                } else if (f == 4) {
                    f1 = 6 * s2 - 1 - d - size * i;
                    f2 = size - 1 - d + size * i;
                    f3 = 2 * s2 + size - 1 - d + size * i;
                    f4 = 4 * s2 - 1 - d - size * i;
                } else if (f == 5) {
                    f1 = 4 * s2 - size - d * size + i;
                    f2 = 2 * s2 - size + d - size * i;
                    f3 = s2 - 1 - d * size - i;
                    f4 = 4 * s2 + d + size * i;
                }
                c = posit[f1];
                posit[f1] = posit[f2];
                posit[f2] = posit[f3];
                posit[f3] = posit[f4];
                posit[f4] = c;
            }
            if (d == 0) {
                for (i = 0; i + i < size; i++) {
                    for (j = 0; j + j < size - 1; j++) {
                        f1 = f * s2 + i + j * size;
                        f3 = f * s2 + (size - 1 - i) + (size - 1 - j) * size;
                        if (f < 3) {
                            f2 = f * s2 + (size - 1 - j) + i * size;
                            f4 = f * s2 + j + (size - 1 - i) * size;
                        } else {
                            f4 = f * s2 + (size - 1 - j) + i * size;
                            f2 = f * s2 + j + (size - 1 - i) * size;
                        }
                        c = posit[f1];
                        posit[f1] = posit[f2];
                        posit[f2] = posit[f3];
                        posit[f3] = posit[f4];
                        posit[f4] = c;
                    }
                }
            }
        }
    }

    return function(size, moveseq) {
        colors = kernel.getProp('colcube').match(colre);
        let cnt = 0;
        for (let i = 0; i < 6; i++) {
            for (let f = 0; f < size * size; f++) {
                posit[cnt++] = i;
            }
        }
        let moves = kernel.parseScramble(moveseq, "DLBURF");
        for (let s = 0; s < moves.length; s++) {
            for (let d = 0; d < moves[s][1]; d++) {
                doslice(moves[s][0], d, moves[s][2], size)
            }
            if (moves[s][1] == -1) {
                for (let d = 0; d < size - 1; d++) {
                    doslice(moves[s][0], d, -moves[s][2], size);
                }
                doslice((moves[s][0] + 3) % 6, 0, moves[s][2] + 4, size);
            }
        }

        let imgSize = kernel.getProp('imgSize') / 50;
        canvas.width(39 * imgSize + 'em');
        canvas.height(29 * imgSize + 'em');

        canvas.attr('width', 39 * size / 9 * width + 1);
        canvas.attr('height', 29 * size / 9 * width + 1);

        for (let i = 0; i < 6; i++) {
            face(i, size);
        }
    }
})();