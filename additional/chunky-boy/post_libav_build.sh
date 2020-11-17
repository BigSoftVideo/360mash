TARGET="dep/libav/build/js/root/lib/pkgconfig/"

for NAME in $(ls $TARGET)
do
	sed -i 's/^prefix=.*$/prefix=dep\/libav\/build\/js\/root/' $TARGET$NAME
done

