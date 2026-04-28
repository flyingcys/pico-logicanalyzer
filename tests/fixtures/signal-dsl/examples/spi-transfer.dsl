# SPI mode 0 单字节传输示例
sample_rate 2MHz
samples 40
channel 0 SCK clock period=4 duty=50%
channel 1 MOSI pattern bits=10100101 repeat=true step=4
channel 2 MISO pattern bits=01011010 repeat=true step=4
channel 3 CS pulse start=2 width=34 value=0 idle=1

