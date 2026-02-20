<main>
  <div class="container mx-auto px-4">
    <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
      <div class="p-8 md:p-12">
        <div class="md:flex md:items-center md:justify-between">
          <div class="md:w-1/1">
            <h1 class="md:text-4xl font-bold text-gray-900 mb-4">Welcome to the booking system</h1>
            <p class="text-xl text-gray-600 mb-6">Book meeting rooms and company cars easily</p>
            <a href="/booking?type=room" class="inline-block bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg shadow-lg"> Book meeting room or a car </a>
            <div class="mt-8 flex justify-center" style="width:200px;">
              <img src="/conference_room.png" alt="Conference room" class="w-full rounded-lg object-cover" />
            </div>
          </div>

          <div class="md:w-1/2 mt-6 md:mt-0 flex justify-end">
            <div class="relative" style="width:520px; height:320px;">
              <div class="absolute right-0 top-0 rounded-lg p-4" style="width:360px;">
                <img src="/screen.png" alt="Hero screen" class="w-full rounded-lg object-cover" />
              </div>

              <div class="absolute -left-10 bottom-0 rounded-lg p-4 z-20" style="width:300px;">
                <img src="/car.png" alt="Hero car" class="w-full rounded-lg object-cover" />
              </div>
            </div>
          </div>
        </div>

        <div class="mt-10 grid gap-6 md:grid-cols-3">
          <div class="bg-white rounded-lg shadow p-6 flex items-start gap-4">
            <img src="/booking.png" alt="" class="w-12 h-12" />
            <div>
              <h3 class="font-semibold text-lg">Easy booking</h3>
              <p class="text-sm text-gray-600">Choose date to book a resource.</p>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow p-6 flex items-start gap-4">
            <img src="/resources.png" alt="" class="w-12 h-12" />
            <div>
              <h3 class="font-semibold text-lg">Manage resources</h3>
              <p class="text-sm text-gray-600">Create meeting rooms and cars and set availability.</p>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow p-6 flex items-start gap-4">
            <img src="/flexibility.png" alt="" class="w-12 h-12" />
            <div>
              <h3 class="font-semibold text-lg">Flexible</h3>
              <p class="text-sm text-gray-600">We offer flexibility.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
